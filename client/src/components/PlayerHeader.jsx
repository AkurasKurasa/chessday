export default function PlayerHeader({ profile, stats, sourceLabel }) {
  return (
    <div className="player">
      <h2>{profile.name}</h2>
      <div className="chips">
        {profile.sample ? <span className="sticker">Sample data</span> : <span className="chip yellow">{sourceLabel}</span>}
        <span className="chip tnum">{stats.n} games</span>
        {profile.rating && (
          <span className="chip tnum">
            {profile.rating} {stats.mainSpeed}
          </span>
        )}
      </div>
    </div>
  );
}
