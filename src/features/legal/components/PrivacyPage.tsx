import { Link } from "react-router-dom";
import { LegalLayout } from "./LegalLayout";

export function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      summary="What SagipMusica collects, why we need it, and how you stay in control of it."
    >
      <h2>Who we are</h2>
      <p>
        SagipMusica is a worship presentation and hymnal tool operated by
        Lumnaire, founded by Ronald Castromero, based in the Philippines. In
        this policy, “we” and “us” mean Lumnaire, and “you” means the person
        using SagipMusica.
      </p>
      <p>
        This policy is written with the Philippine Data Privacy Act of 2012
        (Republic Act No. 10173) in mind, and reflects how the service actually
        works today.
      </p>

      <h2>What we collect</h2>

      <h3>Account information</h3>
      <ul>
        <li>
          <strong>Your email address</strong>, so you can sign in and we can
          send account emails such as verification and password resets.
        </li>
        <li>
          <strong>Your name</strong>, so your team can tell who is who.
        </li>
        <li>
          <strong>Your password</strong>, if you sign up with one. We never see
          it — it is hashed by our authentication provider before storage.
        </li>
        <li>
          <strong>Your Google account's basic profile</strong> (name, email,
          profile picture URL) if you choose to sign in with Google. We do not
          receive your Google password, and we do not get access to your Gmail,
          Drive, contacts, or anything else in your Google account.
        </li>
      </ul>

      <h3>Church information</h3>
      <ul>
        <li>The church name you enter during onboarding.</li>
        <li>
          How you heard about us, which you pick from a short list. We use this
          only to understand which efforts are worth continuing.
        </li>
        <li>The accent colour you choose for your dashboard.</li>
      </ul>

      <h3>Content you create</h3>
      <p>
        Songs, lyrics, song sections, and worship sets that you add. This
        content belongs to your church — see our{" "}
        <Link to="/terms">Terms of Service</Link>.
      </p>

      <h3>Technical information</h3>
      <p>
        Our hosting and database providers keep standard server logs, which can
        include IP addresses and timestamps, for security and troubleshooting.
        We do not run advertising trackers, and we do not currently run any
        analytics product.
      </p>

      <h2>What we do with it</h2>
      <ul>
        <li>Create and secure your account, and keep you signed in.</li>
        <li>Show your church's hymnal, worship sets, and dashboard to your team.</li>
        <li>Send account emails you ask for, such as email verification.</li>
        <li>Keep the service running, diagnose faults, and prevent abuse.</li>
      </ul>
      <p>
        We do not sell your personal information. We do not share it with
        advertisers. We do not use your lyrics or worship sets to train machine
        learning models.
      </p>

      <h2>Who else handles your data</h2>
      <p>
        We use a small number of service providers to run SagipMusica. They
        process data on our instructions:
      </p>
      <table>
        <thead>
          <tr>
            <th>Provider</th>
            <th>What they do</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Supabase</td>
            <td>
              Database, authentication, and account emails. Your account and
              church content are stored here.
            </td>
          </tr>
          <tr>
            <td>Google</td>
            <td>
              Sign in with Google, if you choose it. Google's handling of your
              Google account is governed by their own privacy policy.
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        These providers may store data on servers outside the Philippines. We
        may also disclose information where the law requires it.
      </p>

      <h2>How your church's data is kept separate</h2>
      <p>
        Each church has its own workspace. The database enforces this at the
        row level, so accounts belonging to one church cannot read another
        church's songs or worship sets.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your account and content for as long as your account exists. If
        you delete your account from Settings, we delete your profile
        immediately. If you are the last member of your church, your church and
        all of its songs and worship sets are deleted with it, and this cannot
        be undone. Backups and provider logs may persist for a short period
        afterwards before being overwritten.
      </p>

      <h2>Your rights</h2>
      <p>You can, at any time:</p>
      <ul>
        <li>
          <strong>See and correct your information</strong> — your name, email,
          church name, and content are all editable from inside the app.
        </li>
        <li>
          <strong>Delete your account</strong> — Settings › Delete account.
        </li>
        <li>
          <strong>Change your cookie choices</strong> — see our{" "}
          <Link to="/cookies">Cookie Policy</Link>.
        </li>
        <li>
          <strong>Ask us a question or make a complaint</strong> — contact us
          using the link at the bottom of this page.
        </li>
      </ul>
      <p>
        If you are in the Philippines and believe your data rights have been
        infringed, you may also complain to the National Privacy Commission.
      </p>

      <h2>Security</h2>
      <p>
        Traffic is encrypted in transit. Passwords are hashed, never stored in
        readable form. Access to your church's data is restricted by database
        policy rather than by application code alone. No service can promise
        perfect security, but if a breach affects your personal information, we
        will tell you and the relevant authority as required by law.
      </p>

      <h2>Children</h2>
      <p>
        SagipMusica is intended for church staff and volunteers. It is not
        directed at children under 13, and we do not knowingly collect their
        information. If you believe a child has created an account, contact us
        and we will remove it.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If we change how we handle your information, we will update this page
        and the “last updated” date above. Significant changes will be
        announced in the app.
      </p>
    </LegalLayout>
  );
}
