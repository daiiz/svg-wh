const fetch = require('node-fetch')
const parser = require('fast-xml-parser')

const parserOptions = { ignoreAttributes: false }
const convertToSvg = new parser.j2xParser(parserOptions)

const fetchSvgImage = async url => {
  const res = await fetch(url, { method: 'GET' })
  if (!res.ok) {
    throw new Error('Image response is not OK')
  }
  const contentType = res.headers.get('content-type')
  if (!/^image\/svg\+xml(;\s*charset=utf-8)?$/i.test(contentType)) {
    throw new Error(`Invalid Content-Type: ${contentType}`)
  }
  const text = await res.text()
  if (!text.trim()) {
    throw new Error(`Image is empty`)
  }
  return text
}

const createSizedSvg = (svgText, { width, height }) => {
  if (!parser.validate(svgText)) {
    throw new Error('Invalid SVG image')
  }
  const tree = parser.parse(svgText, parserOptions)
  if (!tree.svg) {
    throw new Error('Invalid SVG image')
  }

  const viewBox = tree.svg['@_viewBox']
  if (!viewBox) return svgText

  const [x, y, rawW, rawH] = viewBox.split(/\s+/).map(v => parseFloat(v))
  if (!rawW || !rawH) return svgText

  const [newW, newH] = calcSizekeepingAspectRatio({ rawW, rawH, width, height })
  tree.svg['@_width'] = `${newW}`
  tree.svg['@_height'] = `${newH}`
  return convertToSvg.parse(tree)
}

const calcSizekeepingAspectRatio = ({ rawW, rawH, width, height }) => {
  if (width) {
    return [width, (rawH / rawW) * width]
  } else if (height) {
    return [(rawW / rawH) * height, height]
  }
  return [rawW, rawH]
}

module.exports = async (req, res) => {
  const { width, height, svg } = req.query
  let svgUrl = ''
  try {
    svgUrl = new URL(svg)
  } catch (err) {
    res.status(400).end(err.message)
  }

  let resSvgText = ''
  try {
    const svgText = await fetchSvgImage(svgUrl)
    resSvgText = createSizedSvg(svgText, { width, height })
  } catch (err) {
    res.status(400).end(err.message)
  }

  res.writeHead(200, {
    'Content-Type': 'image/svg+xml',
    'Cache-Control': `private, max-age=${60 * 60 * 24}` // 1 day
  })
  res.end(resSvgText)
}
