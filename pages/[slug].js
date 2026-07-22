import { createClient } from '@supabase/supabase-js'
import { PublishedWebsiteRenderer } from './sites/[...slug]'
import { getPlatformAppHost, normalizeDomain } from '../lib/website-builder/publishConfig'
import { getPrimaryPublishedWebsite, publishedWebsiteHasPage } from '../lib/website-builder/publicationStore'
import { websiteContentHash } from '../lib/website-builder/documentVersion'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function Page({ blocks, mode, publication, requestedPath }) {
  if (mode === 'published-website' && publication) {
    return <PublishedWebsiteRenderer publication={publication} requestedPath={requestedPath || []} isDomainRequest />
  }

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

export async function getServerSideProps({ params, req, res }) {
  res?.setHeader("Cache-Control", "no-store, max-age=0");
  const requestedPath = [String(params?.slug || '').trim()].filter(Boolean)
  const headers = req?.headers || {}
  const host = normalizeDomain(headers['x-vercel-forwarded-host'] || headers['x-forwarded-host'] || headers.host || '')
  const appHost = getPlatformAppHost()
  const isLocalHost = /^localhost$|^127\.0\.0\.1$/.test(host)
  const isAppHost = host === appHost || host.startsWith('app.')
  if (!isLocalHost && !isAppHost) {
    const publication = await getPrimaryPublishedWebsite(host)
    if (publication && publishedWebsiteHasPage(publication, requestedPath)) {
      const siteData = publication.site_data && typeof publication.site_data === 'object' ? publication.site_data : {}
      const siteDataHash = websiteContentHash(siteData)
      res?.setHeader('X-GR8-Published-Row-Id', publication.id || '')
      res?.setHeader('X-GR8-Published-Project-Id', publication.project_id || siteData.id || '')
      res?.setHeader('X-GR8-Site-Data-Updated-At', siteData.updatedAt || '')
      res?.setHeader('X-GR8-Site-Data-Hash', siteDataHash)
      res?.setHeader('X-GR8-Published-Revision', siteData.publishedVersion || siteData.publication?.publishedVersion || '')
      res?.setHeader('X-GR8-Published-Timestamp', publication.published_at || siteData.publishedAt || siteData.publication?.publishedAt || '')
      res?.setHeader('X-GR8-Snapshot-Hash', siteDataHash)
      res?.setHeader('X-GR8-Requested-Page-Slug', requestedPath.join('/') || 'home')
      return {
        props: {
          mode: 'published-website',
          publication,
          requestedPath,
          blocks: [],
        },
      }
    }
  }

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
