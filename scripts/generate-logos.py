import cairosvg

cairosvg.svg2png(
    url='apps/web/public/images/logo.svg',
    write_to='apps/web/public/images/logo-email.png',
    output_width=400, output_height=120,
    background_color='white'
)
cairosvg.svg2png(
    url='apps/web/public/images/logo.svg',
    write_to='apps/web/public/images/logo-signature.png',
    output_width=320, output_height=96,
    background_color='white'
)
