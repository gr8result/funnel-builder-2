const express = require("express");

const app = express();

app.use(express.json({ limit: "50mb" }));

app.post("/chat/completions", async (req, res) => {
  try {
    const response = await fetch(
      "http://127.0.0.1:11434/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(req.body),
      }
    );

    const text = await response.text();

    res.status(response.status);

    const contentType = response.headers.get("content-type");
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }

    res.send(text);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: {
        message: error.message,
        type: "proxy_error",
      },
    });
  }
});

app.get("/models", async (_req, res) => {
  try {
    const response = await fetch(
      "http://127.0.0.1:11434/v1/models"
    );

    const text = await response.text();

    res.status(response.status);
    res.setHeader(
      "Content-Type",
      response.headers.get("content-type") || "application/json"
    );

    res.send(text);
  } catch (error) {
    res.status(500).json({
      error: {
        message: error.message,
        type: "proxy_error",
      },
    });
  }
});

app.listen(11435, "127.0.0.1", () => {
  console.log(
    "Kilo → Ollama proxy running at http://127.0.0.1:11435"
  );
});