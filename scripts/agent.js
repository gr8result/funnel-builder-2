import fs from 'fs';
import path from 'path';
import readline from 'readline';
import fetch from 'node-fetch';

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error("Error: OPENROUTER_API_KEY environment variable is missing.");
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper to grab all project files for context
function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (!['node_modules', '.git', '.venv', 'dist', 'build'].includes(file)) {
        getFiles(filePath, fileList);
      }
    } else {
      if (['.js', '.json', '.html', '.css', '.md'].includes(path.extname(file))) {
        fileList.push(filePath);
      }
    }
  });
  return fileList;
}

const conversationHistory = [
  {
    role: "system",
    content: "You are an expert autonomous coding assistant. You have access to the user's project files. When the user asks you to modify code, analyze the files and reply in valid JSON format with: {\"message\": \"Your conversational response to the user\", \"target_file\": \"path/to/file.js\" (optional), \"updated_content\": \"full file text\" (optional)}. If you are just chatting or answering questions, you can omit target_file and updated_content, or just return them when code changes are finalized. Do not wrap JSON in markdown blocks."
  }
];

function promptUser() {
  rl.question("\nYou: ", async (input) => {
    if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
      rl.close();
      return;
    }

    // Refresh file contents on each turn so the AI sees current code
    const files = getFiles('.');
    const fileContexts = files.map(file => `--- FILE: ${file} ---\n${fs.readFileSync(file, 'utf8')}\n`).join("\n");

    conversationHistory.push({
      role: "user",
      content: `Current project files:\n${fileContexts}\n\nUser request: ${input}`
    });

    console.log("Thinking...");

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "openai/gpt-4o",
          max_tokens: 2500,
          messages: conversationHistory
        })
      });

      const data = await response.json();
      if (data.choices && data.choices[0]) {
        let aiRaw = data.choices[0].message.content.trim();
        
        // Clean up markdown wrappers if the model adds them
        let cleaned = aiRaw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');
        
        try {
          const parsed = JSON.parse(cleaned);
          console.log(`\nAI: ${parsed.message || "Done."}`);
          
          if (parsed.target_file && parsed.updated_content) {
            fs.writeFileSync(parsed.target_file, parsed.updated_content, 'utf8');
            console.log(`[Updated file: ${parsed.target_file}]`);
          }

          conversationHistory.push({ role: "assistant", content: aiRaw });
        } catch {
          // Fallback if response is plain text instead of JSON
          console.log(`\nAI: ${aiRaw}`);
          conversationHistory.push({ role: "assistant", content: aiRaw });
        }
      } else {
        console.error("OpenRouter Error:", data);
      }
    } catch (err) {
      console.error("Network/API error:", err.message);
    }

    promptUser();
  });
}

console.log("=== Interactive Funnel Builder Coding Assistant ===");
console.log("Type your requests naturally. Type 'exit' to quit.\n");
promptUser();