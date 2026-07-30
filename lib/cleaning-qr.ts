import QRCode from 'qrcode'

export async function printGroupQrCode(group: { id: string; name: string }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || window.location.origin
  const url = `${siteUrl}/renhold/gruppe/${group.id}`
  const dataUrl = await QRCode.toDataURL(url, { width: 320, margin: 2 })

  const win = window.open('', '_blank')
  if (!win) return

  win.document.write(`
    <html>
      <head><title>${group.name}</title></head>
      <body style="text-align:center; font-family:sans-serif; padding:40px;">
        <h1 style="font-size:20px;">${group.name}</h1>
        <img src="${dataUrl}" style="width:320px;height:320px;" />
        <p style="font-size:12px;color:#888;">Skann for å registrere rengjøring</p>
      </body>
    </html>
  `)
  win.document.close()
  win.focus()
  win.print()
}
