import AngleField from './AngleField.jsx'
import { azimuthForOrigin, azimuthFromOrigin, wrap180, wrap360 } from './coordinates.js'

const inRange = (min, max) => (value) => (Number.isFinite(value) && value >= min && value <= max ? value : null)
const wrapped = (wrap) => (value) => (Number.isFinite(value) ? wrap(value) : null)
const latitudeRange = inRange(-90, 90)
const longitudeRange = (value) => (Number.isFinite(value) && Math.abs(value) <= 360 ? wrap180(value) : null)

function SystemCard({ system, code, title, question, reference, badges, children, extra }) {
  return (
    <section className="system-card" data-system={system} aria-labelledby={`${system}-title`}>
      <header className="system-header">
        <span className="system-code" aria-hidden="true">{code}</span>
        <div>
          <h3 id={`${system}-title`}>{title}</h3>
          <p className="system-question">{question}</p>
        </div>
        {extra}
      </header>
      <div className="system-fields">{children}</div>
      <dl className="system-reference">
        {reference.map(([term, description]) => (
          <div key={term}><dt>{term}</dt><dd>{description}</dd></div>
        ))}
      </dl>
      <ul className="system-badges">
        {badges.map(([text, tone]) => <li key={text} data-tone={tone}>{text}</li>)}
      </ul>
    </section>
  )
}

export default function SystemCards({
  observer,
  star,
  hourAngle,
  horizontal,
  mode,
  azimuthOrigin,
  onAzimuthOriginChange,
  onObserverChange,
  onHorizontalChange,
  onHourAngleChange,
  onDeclinationChange,
  onRightAscensionChange,
}) {
  const shownAzimuth = azimuthForOrigin(horizontal.azimuth, azimuthOrigin)
  const originName = azimuthOrigin === 'south' ? 'south' : 'north'

  return (
    <div className="system-grid">
      <SystemCard
        system="geographic"
        code="φ λ"
        title="Geographic"
        question="Where is the observer on Earth?"
        reference={[
          ['Reference circle', 'Earth’s equator'],
          ['Zero point', 'Greenwich meridian'],
          ['Sign', 'N and E positive; S and W negative'],
        ]}
        badges={[['Fixed on Earth', 'fixed']]}
      >
        <AngleField label="Latitude" symbol="φ" kind="latitude" mode={mode} value={observer.latitude} normalize={latitudeRange} rangeHint="−90° to +90°" onCommit={(latitude) => onObserverChange({ latitude })} />
        <AngleField label="Longitude" symbol="λ" kind="longitude" mode={mode} value={observer.longitude} normalize={longitudeRange} rangeHint="180° W to 180° E" onCommit={(longitude) => onObserverChange({ longitude })} />
      </SystemCard>

      <SystemCard
        system="horizon"
        code="A h"
        title="Horizon"
        question="Where do I point an alt-az telescope?"
        extra={(
          <div className="segmented small" role="group" aria-label="Azimuth zero point">
            <button type="button" aria-pressed={azimuthOrigin === 'north'} onClick={() => onAzimuthOriginChange('north')}>from N</button>
            <button type="button" aria-pressed={azimuthOrigin === 'south'} onClick={() => onAzimuthOriginChange('south')}>from S</button>
          </div>
        )}
        reference={[
          ['Reference circle', 'Observer’s horizon'],
          ['Zero point', `${originName[0].toUpperCase()}${originName.slice(1)} point; A runs ${azimuthOrigin === 'south' ? 'S → W → N → E' : 'N → E → S → W'}`],
          ['Altitude', 'From the horizon (0°) to the zenith (+90°)'],
        ]}
        badges={[['Changes with place and time', 'varies'], ['Not usable for catalogues', 'varies']]}
      >
        <AngleField label="Azimuth" symbol="A" kind="positive" mode={mode} value={shownAzimuth} normalize={wrapped(wrap360)} rangeHint={`0° to 360° from ${originName}`} onCommit={(azimuth) => onHorizontalChange(azimuthFromOrigin(azimuth, azimuthOrigin), horizontal.altitude)} />
        <AngleField label="Altitude" symbol="h" kind="degrees" mode={mode} value={horizontal.altitude} normalize={inRange(-90, 90)} rangeHint="−90° to +90°" onCommit={(altitude) => onHorizontalChange(horizontal.azimuth, altitude)} />
      </SystemCard>

      <SystemCard
        system="local"
        code="H δ"
        title="Local equatorial"
        question="Where do I point an equatorial mount?"
        reference={[
          ['Reference circle', 'Celestial equator'],
          ['Zero point', 'M: where the meridian crosses the equator'],
          ['Hour angle', 'Westward, 0h–24h; 1h = 15°'],
        ]}
        badges={[['H changes with place and time', 'varies'], ['δ is fixed', 'fixed']]}
      >
        <AngleField label="Hour angle" symbol="H" kind="hours" mode={mode} value={hourAngle} normalize={wrapped(wrap360)} step={0.25} rangeHint="0h to 24h" onCommit={onHourAngleChange} />
        <AngleField label="Declination" symbol="δ" kind="degrees" mode={mode} value={star.declination} normalize={inRange(-90, 90)} rangeHint="−90° to +90°" onCommit={onDeclinationChange} />
      </SystemCard>

      <SystemCard
        system="global"
        code="α δ"
        title="Equatorial"
        question="Where is it in the star catalogue?"
        reference={[
          ['Reference circle', 'Celestial equator'],
          ['Zero point', 'Vernal equinox ♈'],
          ['Right ascension', 'Eastward, 0h–24h; 1h = 15°'],
        ]}
        badges={[['Independent of place and time', 'fixed'], ['Catalogue coordinates', 'fixed']]}
      >
        <AngleField label="Right ascension" symbol="α" kind="hours" mode={mode} value={star.rightAscension} normalize={wrapped(wrap360)} step={0.25} rangeHint="0h to 24h" onCommit={onRightAscensionChange} />
        <AngleField label="Declination" symbol="δ" kind="degrees" mode={mode} value={star.declination} normalize={inRange(-90, 90)} rangeHint="−90° to +90°" onCommit={onDeclinationChange} />
      </SystemCard>
    </div>
  )
}
