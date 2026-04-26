// /pages/track.js

import { supabase } from "../utils/supabase-client";

export async function getServerSideProps(context) {
  const { product, aff } = context.query;

  if (!product || !aff) {
    return {
      redirect: {
        destination: "/",
        permanent: false,
      },
    };
  }

  // Get product
  const { data: productData } = await supabase
    .from("affiliate_products")
    .select("*")
    .eq("id", product)
    .single();

  if (!productData) {
    return {
      redirect: {
        destination: "/",
        permanent: false,
      },
    };
  }

  // Record click
  await supabase.from("affiliate_clicks").insert([
    {
      product_id: product,
      affiliate_user_id: aff,
      ip_address: context.req.headers["x-forwarded-for"] || "",
      user_agent: context.req.headers["user-agent"] || "",
    },
  ]);

  // Set cookie
  const cookieDays = productData.cookie_duration || 30;
  const expires = new Date();
  expires.setDate(expires.getDate() + cookieDays);

  context.res.setHeader("Set-Cookie", [
    `affiliate_product=${product}; Path=/; Expires=${expires.toUTCString()}`,
    `affiliate_user=${aff}; Path=/; Expires=${expires.toUTCString()}`,
  ]);

  // Redirect to sales page
  return {
    redirect: {
      destination: productData.sales_page_url,
      permanent: false,
    },
  };
}

export default function Track() {
  return null;
}
