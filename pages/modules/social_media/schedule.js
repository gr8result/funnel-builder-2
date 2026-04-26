import { useEffect } from 'react';
import { useRouter } from 'next/router';

// Scheduling is now done directly on the Review page.
export default function ScheduleRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/modules/social_media/review'); }, []);
  return null;
}
