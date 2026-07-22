import dynamic from "next/dynamic";

const WebsiteFooterNavigationQaClient = dynamic(
  () => import("../../components/qa/WebsiteFooterNavigationQaClient"),
  { ssr: false }
);

export default function WebsiteFooterNavigationQa() {
  return <WebsiteFooterNavigationQaClient />;
}
