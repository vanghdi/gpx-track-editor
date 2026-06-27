import { useMemo } from 'react';
import { X } from '@phosphor-icons/react';
import useTrackStore from '../../store/trackStore';
import { haversineDistance } from '../../utils/geoUtils';

const PROFILE_HEIGHTS = {
  compact: 96,
  regular: 136,
  tall: 184,
};

const SVG_WIDTH = 1200;
const CHART_PADDING = { top: 18, right: 12, bottom: 12, left: 12 };
const MIN_SEGMENT_WEIGHT = 0.08;
const MIN_GAP_WEIGHT = 0.06;

function isFiniteElevation(point) {
  return Number.isFinite(point?.ele);
}

function pointDistanceMeters(a, b) {
  if (!a || !b) return 0;
  return haversineDistance(a, b);
}

function buildElevationLayout(segments, gapIndices) {
  const segmentMetrics = segments.map((segment) => {
    const points = segment.points || [];
    let distanceMeters = 0;
    for (let i = 1; i < points.length; i++) {
      distanceMeters += pointDistanceMeters(points[i - 1], points[i]);
    }

    return {
      id: segment.id,
      type: 'segment',
      segment,
      distanceMeters,
      hasElevation: points.some(isFiniteElevation),
      weight: Math.max(distanceMeters / 1000, MIN_SEGMENT_WEIGHT),
    };
  });

  const avgSegmentWeight = segmentMetrics.length
    ? segmentMetrics.reduce((sum, item) => sum + item.weight, 0) / segmentMetrics.length
    : MIN_SEGMENT_WEIGHT;
  const gapWeight = Math.max(avgSegmentWeight * 0.18, MIN_GAP_WEIGHT);

  const items = [];
  segmentMetrics.forEach((item, index) => {
    items.push(item);
    if (gapIndices.has(index)) {
      items.push({
        id: `gap-${index}`,
        type: 'gap',
        weight: gapWeight,
        gapAfter: index,
      });
    }
  });

  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0) || 1;
  let cursor = 0;
  return items.map((item) => {
    const x0 = cursor / totalWeight;
    cursor += item.weight;
    const x1 = cursor / totalWeight;
    return { ...item, x0, x1 };
  });
}

function buildElevationDomain(segments) {
  const elevations = segments
    .flatMap((segment) => segment.points || [])
    .map((point) => point.ele)
    .filter(Number.isFinite);

  if (!elevations.length) return null;

  let min = Math.min(...elevations);
  let max = Math.max(...elevations);
  if (min === max) {
    min -= 10;
    max += 10;
  } else {
    const pad = Math.max((max - min) * 0.12, 8);
    min -= pad;
    max += pad;
  }

  return { min, max };
}

function getGradeClass(fromPoint, toPoint) {
  const distance = pointDistanceMeters(fromPoint, toPoint);
  if (!distance || !isFiniteElevation(fromPoint) || !isFiniteElevation(toPoint)) return 'flat';
  const grade = ((toPoint.ele - fromPoint.ele) / distance) * 100;

  if (grade <= 0) return 'flat';
  if (grade < 4) return 'green';
  if (grade < 8) return 'yellow';
  if (grade < 12) return 'orange';
  if (grade < 20) return 'red';
  return 'brown';
}

function buildSegmentSamples(segment, x0, x1, chartHeight, domain) {
  const points = segment.points || [];
  if (points.length < 2) return [];

  const width = x1 - x0;
  const totalDistance = points.reduce((sum, point, index) => (
    index === 0 ? 0 : sum + pointDistanceMeters(points[index - 1], point)
  ), 0);

  let cumulativeDistance = 0;
  return points.map((point, index) => {
    if (index > 0) cumulativeDistance += pointDistanceMeters(points[index - 1], point);
    const ratio = totalDistance > 0 ? cumulativeDistance / totalDistance : (points.length === 1 ? 0 : index / (points.length - 1));
    const elevationRatio = isFiniteElevation(point)
      ? (point.ele - domain.min) / (domain.max - domain.min)
      : 0;
    return {
      x: x0 + width * ratio,
      y: CHART_PADDING.top + (1 - elevationRatio) * chartHeight,
      valid: isFiniteElevation(point),
    };
  });
}

function buildSegmentLineGroups(samples) {
  const groups = [];
  let current = [];
  for (const sample of samples) {
    if (sample.valid) {
      current.push(sample);
    } else if (current.length) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length) groups.push(current);
  return groups.filter((group) => group.length >= 2);
}

function buildGradeSegments(samples, points) {
  const segments = [];
  for (let i = 1; i < samples.length; i++) {
    if (!samples[i - 1].valid || !samples[i].valid) continue;
    segments.push({
      from: samples[i - 1],
      to: samples[i],
      gradeClass: getGradeClass(points[i - 1], points[i]),
    });
  }
  return segments;
}

function toSvgPath(group) {
  return group.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
}

function toAreaPath(group, baselineY) {
  if (group.length < 2) return '';
  const line = toSvgPath(group);
  const end = group[group.length - 1];
  const start = group[0];
  return `${line} L ${end.x.toFixed(2)} ${baselineY.toFixed(2)} L ${start.x.toFixed(2)} ${baselineY.toFixed(2)} Z`;
}

export default function ElevationProfile() {
  const segments = useTrackStore((s) => s.workingTrack.segments);
  const elevationProfileVisible = useTrackStore((s) => s.elevationProfileVisible);
  const elevationProfileSize = useTrackStore((s) => s.elevationProfileSize);
  const setElevationProfileVisible = useTrackStore((s) => s.setElevationProfileVisible);
  const getGapIndices = useTrackStore((s) => s.getGapIndices);
  const hoveredSegmentId = useTrackStore((s) => s.hoveredSegmentId);
  const setHoveredSegmentId = useTrackStore((s) => s.setHoveredSegmentId);
  const setCenterMapOn = useTrackStore((s) => s.setCenterMapOn);

  const profileHeight = PROFILE_HEIGHTS[elevationProfileSize] || PROFILE_HEIGHTS.regular;

  const model = useMemo(() => {
    if (!elevationProfileVisible || segments.length === 0) return null;

    const gapIndices = new Set(getGapIndices());
    const layout = buildElevationLayout(segments, gapIndices);
    const domain = buildElevationDomain(segments);

    return {
      layout,
      domain,
      hasAnyElevation: !!domain,
    };
  }, [elevationProfileVisible, getGapIndices, segments]);

  if (!elevationProfileVisible || !model) return null;

  const chartHeight = Math.max(profileHeight - CHART_PADDING.top - CHART_PADDING.bottom, 40);
  const baselineY = CHART_PADDING.top + chartHeight;

  return (
    <div
      className="elevation-profile"
      style={{ '--elevation-profile-height': `${profileHeight}px` }}
      aria-hidden="true"
    >
      <button
        className="elevation-profile__close"
        onClick={() => setElevationProfileVisible(false)}
        aria-label="Hide elevation graph"
        title="Hide elevation graph"
      >
        <X size={12} weight="bold" />
      </button>

      <div className="elevation-profile__canvas">
        <svg
          className="elevation-profile__svg"
          viewBox={`0 0 ${SVG_WIDTH} ${profileHeight}`}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="elevationAreaGradient" x1="0%" x2="0%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="var(--elevation-fill-strong)" />
              <stop offset="100%" stopColor="var(--elevation-fill-soft)" />
            </linearGradient>
            <pattern id="elevationGapPattern" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
              <line x1="0" y1="0" x2="0" y2="10" stroke="var(--elevation-gap-stroke)" strokeWidth="2" />
            </pattern>
            <pattern id="elevationMissingPattern" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" stroke="var(--elevation-missing-stroke)" strokeWidth="2" />
            </pattern>
          </defs>

          {[0.25, 0.5, 0.75].map((ratio) => {
            const y = CHART_PADDING.top + chartHeight * ratio;
            return (
              <line
                key={ratio}
                x1={0}
                x2={SVG_WIDTH}
                y1={y}
                y2={y}
                className="elevation-profile__gridline"
              />
            );
          })}

          {model.layout.map((item) => {
            const x = item.x0 * SVG_WIDTH;
            const width = (item.x1 - item.x0) * SVG_WIDTH;
            if (item.type === 'gap') {
              return (
                <rect
                  key={item.id}
                  x={x}
                  y={CHART_PADDING.top}
                  width={width}
                  height={chartHeight}
                  fill="url(#elevationGapPattern)"
                  className="elevation-profile__gap-band"
                />
              );
            }

            return (
              <rect
                key={`${item.id}-band`}
                x={x}
                y={CHART_PADDING.top}
                width={width}
                height={chartHeight}
                className={`elevation-profile__segment-band elevation-profile__segment-band--${item.segment.type === 'routed' ? 'routed' : 'gpx'}${hoveredSegmentId === item.segment.id ? ' elevation-profile__segment-band--active' : ''}`}
              />
            );
          })}

          {model.layout.map((item) => {
            if (item.type !== 'segment' || !model.domain) return null;
            const samples = buildSegmentSamples(
              item.segment,
              item.x0 * SVG_WIDTH,
              item.x1 * SVG_WIDTH,
              chartHeight,
              model.domain
            );
            const groups = buildSegmentLineGroups(samples);
            const lineSegments = buildGradeSegments(samples, item.segment.points || []);

            if (!groups.length) {
              return (
                <rect
                  key={`${item.id}-missing`}
                  x={item.x0 * SVG_WIDTH}
                  y={CHART_PADDING.top}
                  width={(item.x1 - item.x0) * SVG_WIDTH}
                  height={chartHeight}
                  fill="url(#elevationMissingPattern)"
                  className="elevation-profile__missing-band"
                />
              );
            }

            return (
              <g key={`${item.id}-grouped`}>
                {groups.map((group, index) => (
                  <path key={`${item.id}-area-${index}`} d={toAreaPath(group, baselineY)} className="elevation-profile__area" />
                ))}
                {lineSegments.map((lineSegment, lineIndex) => (
                  <line
                    key={`${item.id}-segment-${lineIndex}`}
                    x1={lineSegment.from.x}
                    y1={lineSegment.from.y}
                    x2={lineSegment.to.x}
                    y2={lineSegment.to.y}
                    className={`elevation-profile__line elevation-profile__line--${lineSegment.gradeClass}`}
                  />
                ))}
              </g>
            );
          })}
        </svg>

        {!model.domain && (
          <div className="elevation-profile__empty">
            Elevation appears here once the current segments include altitude data.
          </div>
        )}

        <div className="elevation-profile__labels">
          {model.layout.map((item, index) => {
            if (item.type === 'gap') {
              return (
                <div
                  key={item.id}
                  className="elevation-profile__gap-label"
                  style={{
                    left: `${item.x0 * 100}%`,
                    width: `${(item.x1 - item.x0) * 100}%`,
                  }}
                >
                  gap
                </div>
              );
            }

            const segmentNumber = segments.findIndex((segment) => segment.id === item.segment.id) + 1;
            const isHovered = hoveredSegmentId === item.segment.id;
            return (
              <button
                key={`${item.id}-label-${index}`}
                className={`elevation-profile__segment-label${isHovered ? ' elevation-profile__segment-label--active' : ''}`}
                style={{ left: `${((item.x0 + item.x1) / 2) * 100}%` }}
                onMouseEnter={() => setHoveredSegmentId(item.segment.id)}
                onMouseLeave={() => setHoveredSegmentId(null)}
                onClick={() => {
                  const points = item.segment.points || [];
                  if (!points.length) return;
                  const mid = points[Math.floor(points.length / 2)];
                  setCenterMapOn(mid.lat, mid.lng);
                }}
                title={`Segment #${segmentNumber}`}
              >
                #{segmentNumber}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
