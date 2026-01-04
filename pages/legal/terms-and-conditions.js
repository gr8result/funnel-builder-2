// /pages/legal/terms-of-use.js
// Terms of Use page — styled for dark theme (#0c121a), 1320px max width, readable layout.

import Head from "next/head";

export default function TermsOfUse() {
  if (typeof document !== "undefined") {
    document.body.style.background = "#0c121a";
    document.documentElement.style.background = "#0c121a";
  }

  const container = {
    maxWidth: "1320px",
    margin: "0 auto",
    padding: "60px 20px",
    color: "#fff",
    fontFamily: "Inter, sans-serif",
    lineHeight: "1.7",
  };

  const heading = {
    fontSize: "2.4rem",
    fontWeight: "700",
    marginBottom: "1rem",
    color: "#00bcd4",
  };

  const subheading = {
    fontSize: "1.4rem",
    fontWeight: "600",
    marginTop: "2rem",
    marginBottom: "0.5rem",
    color: "#1de9b6",
  };

  const paragraph = {
    marginBottom: "1rem",
  };

  return (
    <>
      <Head>
        <title>Terms of Use | Gr8 Result Digital Solutions</title>
      </Head>
      <div style={container}>
        <h1 style={heading}>Terms of Use</h1>
        <p style={paragraph}>
          These terms and conditions (“Agreement”) set forth the general terms and conditions of your use of the www.gr8result.com website (“Website” or “Service”) and any of its related products and services (collectively, “Services”). This Agreement is legally binding between you (“User”, “you” or “your”) and www.gr8result.com (“Gr8 Result Digital Solutions”, “we”, “us” or “our”). If you are entering into this agreement on behalf of a business or other legal entity, you represent that you have the authority to bind such entity to this agreement, in which case the terms “User”, “you” or “your” shall refer to such entity. If you do not have such authority, or if you disagree with the terms of this agreement, you must not accept this agreement and may not access and use the Website and Services. By accessing and using the Website and Services, you acknowledge that you have read, understood, and agree to be bound by the terms of this Agreement.
        </p>

        <h2 style={subheading}>Accounts and Membership</h2>
        <p style={paragraph}>
          If you create an account on the Website, you are responsible for maintaining the security of your account, and you are fully responsible for all activities that occur under the account and any other actions taken in connection with it. Providing false contact information may result in the termination of your account. You must immediately notify us of any unauthorised use of your account or other security breaches. We may suspend, disable, or delete your account if we determine you have violated any provision of this Agreement. In addition, we may block your email and IP address to prevent further registration.
        </p>
        <p style={paragraph}>
          This website may contain affiliate links. If you click on a link and make a purchase, we may receive a commission from the seller. We only recommend high-quality products and services that we believe will be beneficial to our users.
        </p>

        <h2 style={subheading}>User Content</h2>
        <p style={paragraph}>
          We do not own any data, information, or material (“Content”) you submit on the Website. You are solely responsible for the accuracy, legality, and ownership of all submitted Content. You grant us permission to access, store, display, and use such Content as required to provide the Services. We may remove or refuse Content that violates policies or is objectionable.
        </p>

        <h2 style={subheading}>Billing and Payments</h2>
        <p style={paragraph}>
          You shall pay all fees and charges in accordance with the billing terms in effect when payment is due. Services offered on a free trial basis may require payment after the trial period ends. Auto-renewal may apply. Sensitive data is transmitted securely over SSL, and PCI standards are followed. We reserve the right to refuse any order and limit quantities as needed.
        </p>

        <h2 style={subheading}>Accuracy of Information</h2>
        <p style={paragraph}>
          The Website may contain errors or omissions. We reserve the right to correct any inaccuracies or update information at any time without notice. No update date should be interpreted as indicating all information is current.
        </p>
        <p style={paragraph}>
          If you use third-party services, your use is governed by their own terms. We do not endorse or assume responsibility for such services and you waive any claims against Gr8 Result Digital Solutions relating to them.
        </p>

        <h2 style={subheading}>Backups</h2>
        <p style={paragraph}>
          We are not responsible for lost Content. It is your responsibility to maintain backups. In limited cases, we may restore some data, but no guarantee is made.
        </p>

        <h2 style={subheading}>Advertisements</h2>
        <p style={paragraph}>
          Any dealings with advertisers or sponsors are solely between you and the third party. We are not responsible for any related correspondence, purchase, or promotion.
        </p>

        <h2 style={subheading}>Links to Other Resources</h2>
        <p style={paragraph}>
          The Website may link to other websites. We are not responsible for their content or practices. Some may contain affiliate links, from which we may earn a commission. Use of these sites is at your own risk.
        </p>

        <h2 style={subheading}>Prohibited Uses</h2>
        <p style={paragraph}>
          You are prohibited from using the Website and Services for unlawful acts, infringing intellectual property, spreading malware, or engaging in abusive or fraudulent activity. We reserve the right to terminate access for violations.
        </p>

        <h2 style={subheading}>Intellectual Property Rights</h2>
        <p style={paragraph}>
          All intellectual property remains the property of Gr8 Result Digital Solutions or its licensors. Using the Website grants no right to reproduce or use any trademarks or content.
        </p>

        <h2 style={subheading}>Limitation of Liability</h2>
        <p style={paragraph}>
          To the fullest extent permitted by law, Gr8 Result Digital Solutions and its affiliates will not be liable for indirect, incidental, special, or consequential damages, including loss of profits, data, or goodwill. Our total liability is limited to one dollar or the amount you paid to us during the prior month. The information provided on this website is for general purposes only and not professional advice. Always consult a qualified expert before acting on any information.
        </p>

        <h2 style={subheading}>Indemnification</h2>
        <p style={paragraph}>
          You agree to indemnify and hold harmless Gr8 Result Digital Solutions, its employees, and affiliates against any claims, damages, or expenses arising from your use of the Website or violation of this Agreement.
        </p>

        <h2 style={subheading}>Severability</h2>
        <p style={paragraph}>
          If any provision of this Agreement is deemed invalid, the remaining provisions will remain in effect.
        </p>

        <h2 style={subheading}>Dispute Resolution</h2>
        <p style={paragraph}>
          This Agreement is governed by the laws of Queensland, Australia. The courts of Queensland shall have exclusive jurisdiction. You waive any right to a jury trial.
        </p>

        <h2 style={subheading}>Changes and Amendments</h2>
        <p style={paragraph}>
          We may modify these terms at any time. The updated date will appear on this page, and continued use of the Website constitutes acceptance of changes.
        </p>

        <h2 style={subheading}>Acceptance of These Terms</h2>
        <p style={paragraph}>
          By accessing and using this Website, you acknowledge that you have read and agree to these Terms of Use. If you do not agree, do not use our Website or Services.
        </p>

        <h2 style={subheading}>Affiliate Disclosure</h2>
        <p style={paragraph}>
          Some links on our website are affiliate links, meaning we may earn a commission if you make a purchase. We only recommend products we genuinely believe in. These commissions support our platform and content creation.
        </p>

        <h2 style={subheading}>Contacting Us</h2>
        <p style={paragraph}>
          If you have any questions or concerns about this Agreement, contact us:
          <br />
          <br />
          <strong>This page:</strong> www.gr8result.com/terms-of-use <br />
          <strong>Home Page:</strong>{" "}
          <a href="https://gr8result.com/" style={{ color: "#00bcd4" }}>
            https://gr8result.com/
          </a>
          <br />
          <strong>Email:</strong>{" "}
          <a href="mailto:support@gr8result.com" style={{ color: "#00bcd4" }}>
            support@gr8result.com
          </a>
          <br />
          <strong>WhatsApp:</strong> +61 417 004 315
        </p>
      </div>
    </>
  );
}
