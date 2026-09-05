import Link from 'next/link';
import { useRouter } from 'next/router';
import { safeSelectionNavigate } from '../lib/navigation/selectionNavigation.js';

export default function SafeSelectionLink({ href, onClick, children, ...props }) {
  const router = useRouter();
  return <Link {...props} href={href} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || props.target === '_blank') return;
    event.preventDefault();
    safeSelectionNavigate(router, href);
  }}>{children}</Link>;
}
