// /pages/f/[id].js
import Head from "next/head";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Server-render a saved page by database ID.
// Renders the stored HTML as-is (with its own <style> block).
export async function getServerSideProps(ctx) {
  const id = ctx.params?.id || null;
  if (!id) return { notFound: true };

  // server-side Supabase (service role so RLS doesn't block public views)
  const supabase = createClient(url, serviceKey);

  const { data: page, error } = await supabase
    .from("pages")
    .select("id, title, slug, html, published")
    .eq("id", id)
    .single();

  if (error || !page) return { notFound: true };

  return { props: { page } };
}

export default function PublicPage({ page }) {
  // safety: if something went wrong, don't crash client-side
  if (!page) return <main style={{ padding: 24 }}>Not found.</main>;

  // If you ever want to redirect published+slug to /p/[slug], you could do it
  // here with a <meta refresh> or server-side in getServerSideProps. For now,
  // just render what we have.
  return (
    <>
      <Head>
        <title>{page.title || "Page"}</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div
        // The saved HTML includes its own <style>, so we render it raw:
        dangerouslySetInnerHTML={{ __html: page.html || "" }}
      />
    </>
  );
}
