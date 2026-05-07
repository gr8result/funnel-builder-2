import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function SocialImageLibraryRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/assets');
  }, [router]);

  return null;
}
