import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function Page({ blocks }) {
  return (
    <div style={{ padding: '20px' }}>
      {blocks.map((block) => (
        <BlockRenderer key={block.id} block={block} />
      ))}
    </div>
  )
}

function BlockRenderer({ block }) {
  switch (block.type) {
    case 'text':
      return (
        <div
          dangerouslySetInnerHTML={{
            __html: block.props?.content || ''
          }}
        />
      )

    case 'form':
      return <FormBlock fields={block.props?.fields || []} />

    default:
      return null
  }
    }

    function FormBlock({ fields }) {
      return (
        <form
          onSubmit={async (e) => {
      e.preventDefault()

      const formData = new FormData(e.target)
      const data = Object.fromEntries(formData.entries())

      try {
        const res = await fetch('/api/form-submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        })

        const result = await res.json()

        if (result.success) {
          alert('Lead captured successfully')
        } else {
          alert('Something went wrong')
        }
      } catch (err) {
        console.error(err)
        alert('Error submitting form')
      }
    }}

>
      {fields.map((field) => (
        <input
          key={field.name}
          name={field.name}
          placeholder={field.placeholder}
          style={{
            display: 'block',
            marginBottom: '10px',
            padding: '8px',
            width: '300px'
          }}
        />
      ))}

      <button type="submit">Submit</button>
    </form>
  )
}

export async function getServerSideProps({ params }) {
  const { data: page, error } = await supabase
    .from('pages')
    .select('*')
    .eq('slug', params.slug)
    .eq('published', true)
    .single()

  if (!page || error) {
    return { notFound: true }
  }

  return {
    props: {
      blocks: page.blocks || []
    }
  }
}