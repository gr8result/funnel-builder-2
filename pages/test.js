import { createClient } from '@supabase/supabase-js'
import { useState } from 'react'

export default function Page({ blocks }) {
  console.log('BLOCKS:', blocks)

  return (
    <div style={{ padding: 40 }}>
      {blocks && blocks.length > 0 ? (
        blocks.map((block, i) => {
          if (block.type === 'form') {
            return <FormBlock key={i} block={block} />
          }
          return null
        })
      ) : (
        <div>No blocks found</div>
      )}
    </div>
  )
}

function FormBlock({ block }) {
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(false)

  const handleChange = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async () => {
    setLoading(true)

    const res = await fetch('/api/form-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })

    if (res.ok) {
      alert('Lead captured successfully')
    } else {
      alert('Something went wrong')
    }

    setLoading(false)
  }

  return (
    <div>
      <h3>Lead Capture</h3>

      {Array.isArray(block.fields) &&
        block.fields.map((field, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <input
              type={field.type || 'text'}
              placeholder={field.label}
              onChange={(e) =>
                handleChange(field.name, e.target.value)
              }
              style={{ padding: 8, width: 250 }}
            />
          </div>
        ))}

      <button onClick={handleSubmit} disabled={loading}>
        {loading ? 'Sending...' : block.submitText || 'Submit'}
      </button>
    </div>
  )
}

export async function getServerSideProps() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const { data, error } = await supabase
    .from('pages')
    .select('blocks')
    .eq('slug', 'test')
    .single()

  console.log('DB DATA:', data, error)

  return {
    props: {
      blocks: data?.blocks || []
    }
  }
}