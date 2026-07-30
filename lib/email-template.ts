export function renderEmailHtml(opts: {
  heading: string
  bodyHtml: string
  ctaLabel?: string
  ctaUrl?: string
}): string {
  const { heading, bodyHtml, ctaLabel, ctaUrl } = opts

  const cta = ctaLabel && ctaUrl
    ? `
      <tr>
        <td style="padding: 8px 32px 32px 32px;">
          <a href="${ctaUrl}" style="display: inline-block; background-color: #f2a152; color: #001f3c; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 20px; border-radius: 8px;">
            ${ctaLabel}
          </a>
        </td>
      </tr>
    `
    : ''

  return `
<!doctype html>
<html lang="no">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin: 0; padding: 0; background-color: #faf6ee; font-family: Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #faf6ee; padding: 24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; max-width: 480px; width: 100%;">
            <tr>
              <td style="background-color: #001f3c; padding: 20px 32px;">
                <span style="color: #f2a152; font-size: 18px; font-weight: 700; letter-spacing: 0.05em;">ZEST</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 32px 32px 8px 32px;">
                <h1 style="margin: 0 0 16px 0; color: #001f3c; font-size: 20px;">${heading}</h1>
                <div style="color: #333333; font-size: 14px; line-height: 1.6;">${bodyHtml}</div>
              </td>
            </tr>
            ${cta}
            <tr>
              <td style="padding: 16px 32px; border-top: 1px solid #eeeeee;">
                <p style="margin: 0; color: #999999; font-size: 12px;">Denne e-posten ble sendt fra ZEST internportal.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`
}
