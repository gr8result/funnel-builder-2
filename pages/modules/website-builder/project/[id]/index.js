import { useRouter } from "next/router";
import { useEffect } from "react";

export default function WebsiteProjectEditorPage() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady || !router.query?.id) return;

    const params = new URLSearchParams();
    params.set("projectId", String(router.query.id));
    if (router.query?.page) params.set("page", String(router.query.page));

    router.replace(`/modules/website-builder/visual-builder?${params.toString()}`);
  }, [router.isReady, router.query?.id, router.query?.page, router.query?.editor]);

  return null;
}
