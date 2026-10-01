import {
  Body,
  Button,
  Column,
  Container,
  Font,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "react-email";

// Palette mirrors the website design tokens in app/globals.css
// (sage + sand spa palette, Outfit sans + Playfair Display serif).
const sage = {
  50: "#f6f7f4",
  100: "#e8ebe3",
  200: "#d2d9c8",
  300: "#b3c0a1",
  400: "#94a67a",
  500: "#778c5d",
  600: "#5d7048",
  700: "#4a5a3b",
  900: "#343f2c",
};

const sand = {
  50: "#faf8f5",
  900: "#5d4a3b",
};

const sansStack = "'Outfit', 'Helvetica Neue', Arial, sans-serif";
const serifStack = "'Playfair Display', Georgia, 'Times New Roman', serif";
const monoStack = "'Courier New', Courier, monospace";

export interface VoucherGiftEmailProps {
  recipientName: string;
  senderName: string;
  senderMessage: string | null;
  voucherCode: string;
  serviceName: string;
  serviceDuration: number;
  formattedAmount: string;
  formattedExpiry: string;
}

const redeemSteps = [
  "Call us at +62 361 123 4567 to book your appointment",
  "Present this voucher code when you arrive",
  "Enjoy your spa experience!",
];

function RedeemStep({ index, children }: { index: number; children: string }) {
  return (
    <Row style={styles.stepRow}>
      <Column style={styles.stepBadgeColumn} valign="top">
        <Section style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>{index}</Text>
        </Section>
      </Column>
      <Column style={styles.stepTextColumn} valign="top">
        <Text style={styles.stepText}>{children}</Text>
      </Column>
    </Row>
  );
}

export function VoucherGiftEmail({
  recipientName,
  senderName,
  senderMessage,
  voucherCode,
  serviceName,
  serviceDuration,
  formattedAmount,
  formattedExpiry,
}: VoucherGiftEmailProps) {
  return (
    <Html lang="en">
      <Head>
        <title>Your Kalanara Spa Gift Voucher</title>
        <Font
          fontFamily="Outfit"
          fallbackFontFamily={["Helvetica", "Arial", "sans-serif"]}
          webFont={{
            url: "https://fonts.gstatic.com/s/outfit/v15/QGYvz_MVcBeNP4NJtEtq.woff2",
            format: "woff2",
          }}
          fontWeight={400}
          fontStyle="normal"
        />
        <Font
          fontFamily="Outfit"
          fallbackFontFamily={["Helvetica", "Arial", "sans-serif"]}
          webFont={{
            url: "https://fonts.gstatic.com/s/outfit/v15/QGYvz_MVcBeNP4NJtEtq.woff2",
            format: "woff2",
          }}
          fontWeight={600}
          fontStyle="normal"
        />
        <Font
          fontFamily="Playfair Display"
          fallbackFontFamily={["Georgia", "Times New Roman", "serif"]}
          webFont={{
            url: "https://fonts.gstatic.com/s/playfairdisplay/v40/nuFkD-vYSZviVYUb_rj3ij__anPXDTnogkk7.woff2",
            format: "woff2",
          }}
          fontWeight={400}
          fontStyle="italic"
        />
      </Head>
      <Preview>A luxurious spa experience at Kalanara Spa awaits you.</Preview>
      <Body style={styles.body}>
        <Container style={styles.card}>
          <Section style={styles.header} data-skip-in-text="true">
            <Text style={styles.brand}>KALANARA</Text>
            <Text style={styles.tagline}>Harmony in Every Touch</Text>
          </Section>

          <Section style={styles.section}>
            <Text style={styles.eyebrow}>A Special Gift For You</Text>
            <Heading style={styles.greeting}>
              Dear{" "}
              <span style={styles.greetingEmphasis}>{recipientName}</span>,
            </Heading>
            <Text style={styles.bodyText}>
              {senderName} has gifted you a luxurious spa experience at Kalanara
              Spa.
            </Text>
            {senderMessage ? (
              <Section style={styles.messageBox}>
                <Text style={styles.messageQuote}>&ldquo;{senderMessage}&rdquo;</Text>
                <Text style={styles.messageAttribution}>{`— ${senderName}`}</Text>
              </Section>
            ) : null}
          </Section>

          <Section style={styles.sectionTight}>
            <Container style={styles.voucherCard}>
              <Text style={styles.voucherLabel}>Your Voucher Code</Text>
              <Text style={styles.voucherCode}>{voucherCode}</Text>
              <Section style={styles.voucherDetails}>
                <Text style={styles.detailLabel}>Treatment</Text>
                <Text style={styles.detailName}>{serviceName}</Text>
                <Hr style={styles.detailDivider} />
                <Row>
                  <Column style={styles.detailColumn}>
                    <Text style={styles.detailLabel}>Duration</Text>
                    <Text style={styles.detailValue}>
                      {`${serviceDuration} mins`}
                    </Text>
                  </Column>
                  <Column style={styles.detailColumn}>
                    <Text style={styles.detailLabel}>Value</Text>
                    <Text style={styles.detailValue}>{formattedAmount}</Text>
                  </Column>
                </Row>
              </Section>
              <Text style={styles.voucherExpiry}>
                {`Valid until ${formattedExpiry}`}
              </Text>
            </Container>
          </Section>

          <Section style={styles.sectionTight}>
            <Heading style={styles.redeemHeading}>How to Redeem</Heading>
            {redeemSteps.map((step, index) => (
              <RedeemStep key={step} index={index + 1}>
                {step}
              </RedeemStep>
            ))}
            <Section style={styles.ctaSection} data-skip-in-text="true">
              <Button
                style={styles.ctaButton}
                href="tel:+623611234567"
              >
                Book Your Appointment
              </Button>
            </Section>
          </Section>

          <Hr style={styles.footerDivider} />

          <Section style={styles.footer} data-skip-in-text="true">
            <Text style={styles.footerBrand}>KALANARA SPA</Text>
            <Text style={styles.footerText}>
              <Link
                href="https://maps.google.com/?q=Jl.+Raya+Ubud+No.+88,+Ubud,+Bali+80571"
                style={styles.footerLink}
              >
                Jl. Raya Ubud No. 88, Ubud, Bali 80571
              </Link>
            </Text>
            <Text style={styles.footerText}>
              +62 361 123 4567 |{" "}
              <Link href="mailto:hello@kalanaraspa.com" style={styles.footerLink}>
                hello@kalanaraspa.com
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default VoucherGiftEmail;

const styles = {
  body: {
    backgroundColor: sand[50],
    fontFamily: sansStack,
    margin: 0,
    padding: 0,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    boxShadow: "0 4px 20px rgba(93, 112, 72, 0.08)",
    margin: "40px auto",
    maxWidth: "600px",
    overflow: "hidden",
    padding: 0,
    width: "100%",
  },
  header: {
    backgroundColor: sage[600],
    backgroundImage: "linear-gradient(135deg, #4a5a3b 0%, #778c5d 100%)",
    padding: "48px 40px",
    textAlign: "center" as const,
  },
  brand: {
    color: sand[50],
    fontSize: "28px",
    fontWeight: 600,
    letterSpacing: "6px",
    margin: 0,
  },
  tagline: {
    color: sage[200],
    fontFamily: serifStack,
    fontSize: "14px",
    fontStyle: "italic",
    margin: "8px 0 0",
  },
  section: {
    padding: "40px 40px 0",
  },
  sectionTight: {
    padding: "32px 40px 0",
  },
  eyebrow: {
    color: sage[500],
    fontSize: "12px",
    letterSpacing: "3px",
    margin: "0 0 12px",
    textTransform: "uppercase" as const,
  },
  greeting: {
    color: sage[900],
    fontSize: "32px",
    fontWeight: 600,
    lineHeight: "1.3",
    margin: "0 0 16px",
  },
  greetingEmphasis: {
    color: sage[600],
    fontFamily: serifStack,
    fontStyle: "italic",
    fontWeight: 400,
  },
  bodyText: {
    color: sand[900],
    fontSize: "16px",
    lineHeight: "1.6",
    margin: "0 0 24px",
  },
  messageBox: {
    backgroundColor: sage[50],
    borderLeft: `4px solid ${sage[400]}`,
    borderRadius: "12px",
    margin: "0 0 8px",
    padding: "20px 24px",
  },
  messageQuote: {
    color: sage[700],
    fontFamily: serifStack,
    fontStyle: "italic",
    fontSize: "15px",
    lineHeight: "1.6",
    margin: 0,
  },
  messageAttribution: {
    color: sage[500],
    fontSize: "13px",
    margin: "12px 0 0",
  },
  voucherCard: {
    backgroundColor: sage[600],
    backgroundImage: "linear-gradient(135deg, #4a5a3b 0%, #778c5d 100%)",
    borderRadius: "16px",
    padding: "32px",
    textAlign: "center" as const,
    width: "100%",
  },
  voucherLabel: {
    color: sage[200],
    fontSize: "12px",
    letterSpacing: "2px",
    margin: "0 0 8px",
    textTransform: "uppercase" as const,
  },
  voucherCode: {
    color: "#ffffff",
    fontFamily: monoStack,
    fontSize: "28px",
    fontWeight: 700,
    letterSpacing: "3px",
    margin: "0 0 24px",
  },
  voucherDetails: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: "12px",
    padding: "20px",
  },
  detailLabel: {
    color: sage[200],
    fontSize: "11px",
    letterSpacing: "1px",
    margin: "0 0 4px",
    textTransform: "uppercase" as const,
  },
  detailName: {
    color: "#ffffff",
    fontSize: "18px",
    fontWeight: 500,
    margin: "0 0 16px",
  },
  detailDivider: {
    border: "none",
    borderTop: "1px solid rgba(255, 255, 255, 0.2)",
    margin: "0 0 16px",
  },
  detailColumn: {
    padding: "0 8px",
    textAlign: "center" as const,
  },
  detailValue: {
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: 500,
    margin: 0,
  },
  voucherExpiry: {
    color: sage[300],
    fontSize: "13px",
    margin: "20px 0 0",
  },
  redeemHeading: {
    color: sage[900],
    fontSize: "18px",
    fontWeight: 600,
    margin: "0 0 20px",
  },
  stepRow: {
    marginBottom: "14px",
  },
  stepBadgeColumn: {
    verticalAlign: "top",
    width: "36px",
  },
  stepBadge: {
    backgroundColor: sage[600],
    borderRadius: "14px",
    height: "28px",
    lineHeight: "28px",
    padding: 0,
    textAlign: "center" as const,
    width: "28px",
  },
  stepBadgeText: {
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: "28px",
    margin: 0,
  },
  stepTextColumn: {
    verticalAlign: "top",
  },
  stepText: {
    color: sand[900],
    fontSize: "14px",
    lineHeight: "28px",
    margin: 0,
  },
  ctaSection: {
    margin: "28px 0 8px",
    textAlign: "center" as const,
  },
  ctaButton: {
    backgroundColor: sage[600],
    borderRadius: "12px",
    color: "#ffffff",
    display: "inline-block",
    fontSize: "15px",
    fontWeight: 500,
    padding: "14px 32px",
    textDecoration: "none",
  },
  footerDivider: {
    border: "none",
    borderTop: `1px solid ${sage[200]}`,
    margin: "32px 0 0",
  },
  footer: {
    backgroundColor: sage[50],
    padding: "32px 40px",
    textAlign: "center" as const,
  },
  footerBrand: {
    color: sage[900],
    fontSize: "15px",
    fontWeight: 600,
    letterSpacing: "2px",
    margin: "0 0 8px",
  },
  footerText: {
    color: sand[900],
    fontSize: "13px",
    lineHeight: "1.6",
    margin: "0 0 4px",
  },
  footerLink: {
    color: sage[600],
    textDecoration: "underline",
  },
};