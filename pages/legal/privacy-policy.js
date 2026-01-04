// /pages/legal/privacy-policy.js
// Privacy Policy page — styled for dark theme (#0c121a), 1320px max width, clean typography.

import Head from "next/head";

export default function PrivacyPolicy() {
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
        <title>Privacy Policy | Gr8 Result Digital Solutions</title>
      </Head>
      <div style={container}>
        <h1 style={heading}>Privacy Policy</h1>

        <h2 style={subheading}>Who We Are</h2>
        <p style={paragraph}>
          Our website address is:{" "}
          <a href="https://gr8result.com" style={{ color: "#00bcd4" }}>
            https://gr8result.com
          </a>
          .
        </p>

        <h2 style={subheading}>Comments</h2>
        <p style={paragraph}>
          When visitors leave comments, we collect the data shown in the form,
          plus the visitor’s IP address and browser user agent string to help
          spam detection. An anonymised string from your email may be provided
          to the Gravatar service to check if you are using it. See{" "}
          <a
            href="https://automattic.com/privacy/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#00bcd4" }}
          >
            https://automattic.com/privacy/
          </a>
          . After approval, your profile picture is visible publicly with your
          comment.
        </p>

        <h2 style={subheading}>Media</h2>
        <p style={paragraph}>
          If you upload images, avoid including embedded location data (EXIF
          GPS). Visitors can download and extract this data from images.
        </p>

        <h2 style={subheading}>Cookies</h2>
        <p style={paragraph}>
          If you leave a comment, you may opt to save your name, email and
          website in cookies for convenience. These last one year. Login and
          screen option cookies may also be set to save preferences. “Remember
          Me” keeps you logged in for two weeks; logout removes them. Editing or
          publishing content sets an additional cookie lasting one day.
        </p>

        <h2 style={subheading}>Embedded Content from Other Websites</h2>
        <p style={paragraph}>
          Articles may include embedded content (e.g. videos, images, articles).
          Such content behaves exactly as if the visitor had visited the source
          site, which may collect data and use cookies or tracking tools.
        </p>

        <h2 style={subheading}>Who We Share Your Data With</h2>
        <p style={paragraph}>
          If you request a password reset, your IP address will be included in
          the reset email.
        </p>

        <h2 style={subheading}>How Long We Retain Your Data</h2>
        <p style={paragraph}>
          Comments and metadata are retained indefinitely for recognition of
          follow-ups. For registered users, personal info in their profile can
          be seen, edited, or deleted at any time (except usernames). Admins can
          also view and edit this information.
        </p>

        <h2 style={subheading}>What Rights You Have Over Your Data</h2>
        <p style={paragraph}>
          If you have an account or have left comments, you can request an
          exported file of personal data we hold about you, or request erasure
          of personal data except that required for legal or security reasons.
        </p>

        <h2 style={subheading}>Where Your Data Is Sent</h2>
        <p style={paragraph}>
          Visitor comments may be checked through an automated spam detection
          service.
        </p>
      </div>
    </>
  );
}
