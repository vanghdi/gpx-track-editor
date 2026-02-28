/**
 * Convert working track segments into a GPX XML string.
 * @param {string} trackName
 * @param {Array} segments  — each segment has a `points` array of {lat,lng,ele?}
 */
export function exportGPX(trackName, segments) {
  const allPoints = segments.flatMap((seg) => seg.points);

  const trkpts = allPoints
    .map((p) => {
      const ele = p.ele !== undefined ? `\n        <ele>${p.ele.toFixed(1)}</ele>` : '';
      return `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lng.toFixed(7)}">${ele}\n      </trkpt>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Track Editor"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(trackName)}</name>
  </metadata>
  <trk>
    <name>${escapeXml(trackName)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
