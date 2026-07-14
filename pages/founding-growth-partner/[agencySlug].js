import FoundingGrowthPartnerPage from "../../components/founding-growth-partner/FoundingGrowthPartnerPage";

export default function FoundingGrowthPartnerAgency({ agencySlug }) {
  return <FoundingGrowthPartnerPage agencySlug={agencySlug} />;
}

FoundingGrowthPartnerAgency.disableLayout = true;

export function getServerSideProps(ctx) {
  return {
    props: {
      agencySlug: String(ctx.params?.agencySlug || ""),
    },
  };
}
