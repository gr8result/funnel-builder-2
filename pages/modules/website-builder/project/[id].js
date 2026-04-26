import { useRouter } from "next/router";
import { useEffect } from "react";

export default function WebsiteProjectEditorPage() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady || !router.query?.id) return;

    const params = new URLSearchParams();
    if (router.query?.page) params.set("page", String(router.query.page));
    params.set("editor", String(router.query?.editor || "grapesjs"));

    router.replace(`/modules/website-builder/project/${router.query.id}/canvas?${params.toString()}`);
  }, [router.isReady, router.query?.id, router.query?.page, router.query?.editor]);

  return null;
}
