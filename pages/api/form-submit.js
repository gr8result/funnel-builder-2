// /pages/api/form-submit.js

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { name, email } = req.body

    console.log('Incoming:', { name, email })

    // ✅ SAVE TO FORM SUBMISSIONS ONLY (NO FK = NO FAIL)
    const { error } = await supabase
      .from('form_submissions')
      .insert([
        {
          name: name || null,
          email: email || null
        }
      ])

    if (error) {
      console.error('DB ERROR:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ success: true })

  } catch (err) {
    console.error('SERVER ERROR:', err)
    return res.status(500).json({ error: err.message })
  }
}