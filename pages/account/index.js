import Head from "next/head";
import Layout from "../../components/Layout";
import BusinessProfileVault from "../../components/account/BusinessProfileVault";

export default function AccountPage() {
  return (
    <Layout>
      <Head>
        <title>Business Profile Vault | GR8 Result</title>
      </Head>
      <BusinessProfileVault />
    </Layout>
  );
}
