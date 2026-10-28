// Full-screen landing page editor.

import { useRouter } from 'next/router';
import AuthGate from '../../../../components/AuthGate';
import LandingPageEditor from '../../../../components/landing-pages/editor/LandingPageEditor';

export default function LandingPageEditorPage() {
  const { pageId } = useRouter().query;
  return <AuthGate>{pageId ? <LandingPageEditor pageId={String(pageId)} /> : null}</AuthGate>;
}

LandingPageEditorPage.disableLayout = true;
