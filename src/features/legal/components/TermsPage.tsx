import { Link } from "react-router-dom";
import { LegalLayout } from "./LegalLayout";

export function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      summary="The agreement between your church and SagipMusica, in plain terms."
    >
      <h2>Agreement</h2>
      <p>
        By creating an account or using SagipMusica, you agree to these terms.
        If you are setting up SagipMusica for a church, you confirm you are
        authorised to accept these terms on its behalf. If you don't agree,
        please don't use the service.
      </p>

      <h2>What SagipMusica is</h2>
      <p>
        SagipMusica is a tool for churches to keep a hymnal, build worship sets,
        and project lyrics during a service. It is operated by Lumnaire and is
        currently offered free of charge.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>Give accurate information when you sign up, and keep it current.</li>
        <li>
          Keep your password and sign-in details to yourself. You are
          responsible for what happens under your account.
        </li>
        <li>
          The person who completes onboarding becomes the administrator of that
          church and can edit its hymnal and settings.
        </li>
        <li>
          Tell us promptly if you think someone else has access to your account.
        </li>
      </ul>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Break the law, or use SagipMusica to help anyone else do so.</li>
        <li>
          Upload content that is unlawful, hateful, or infringes someone else's
          rights.
        </li>
        <li>
          Try to access another church's workspace, probe our security, or
          disrupt the service for others.
        </li>
        <li>Resell or rebrand SagipMusica as your own product.</li>
      </ul>

      <h2>Your content, and song copyright</h2>
      <p>
        <strong>The songs, lyrics, and worship sets you add remain yours.</strong>{" "}
        We claim no ownership over them. You grant us only the permission we
        need to store and display that content back to your church so the
        service works.
      </p>
      <p>
        <strong>
          Reproducing or projecting song lyrics is a copyright matter, and it is
          your responsibility.
        </strong>{" "}
        Many worship songs and modern hymn translations are still under
        copyright. Most churches cover this with a licence such as CCLI. Before
        you add lyrics to SagipMusica and put them on a screen, make sure your
        church is licensed to do so. We are not able to grant you those rights,
        and we do not check the copyright status of anything you add.
      </p>

      <h3>The starter hymns we include</h3>
      <p>
        New churches begin with a small library of well-known hymns, to save you
        typing. We include full lyrics only for hymns we believe are in the
        public domain. A small number of titles are included as name and key
        only, with no words, because they remain under copyright — you can add
        those words yourself once you've confirmed your licence covers them.
      </p>
      <p>
        Public domain status can differ between countries. If your church is
        outside the Philippines, please check what applies where you are.
      </p>

      <h2>Our rights</h2>
      <p>
        The SagipMusica name, logo, design, and software belong to Lumnaire.
        These terms don't give you rights to them beyond using the service as
        intended.
      </p>

      <h2>Availability and warranties</h2>
      <p>
        SagipMusica is provided “as is” and “as available”. We work to keep it
        running, but we don't promise it will be uninterrupted or error-free,
        and we may change or discontinue features. Because the service is free,
        we cannot offer guaranteed uptime.
      </p>
      <p>
        <strong>Keep your own copy of anything you can't afford to lose.</strong>{" "}
        We are not a backup service.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent the law allows, Lumnaire is not liable for
        indirect or consequential loss, lost data, or loss arising from your use
        of or inability to use SagipMusica — including during a service. Nothing
        here limits liability that cannot be limited by law.
      </p>

      <h2>Suspension and ending your account</h2>
      <p>
        You can delete your account at any time from Settings. If you are the
        last member of your church, deleting your account also permanently
        deletes that church's songs and worship sets.
      </p>
      <p>
        We may suspend or remove an account that breaks these terms, or that
        puts the service or other churches at risk. Where it's reasonable to do
        so, we'll tell you first.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms as the service develops. We'll update the
        “last updated” date above, and announce significant changes in the app.
        Continuing to use SagipMusica after a change means you accept the
        updated terms.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of the Republic of the
        Philippines, and disputes fall to the courts of the Philippines.
      </p>

      <h2>Privacy</h2>
      <p>
        How we handle your information is covered in our{" "}
        <Link to="/privacy">Privacy Policy</Link>, and what we store on your
        device is covered in our <Link to="/cookies">Cookie Policy</Link>.
      </p>
    </LegalLayout>
  );
}
