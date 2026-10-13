/** The small dot between the parts of a meta line ("WI-23445213 • Initiated by ..."). */
export default function Bullet() {
  return (
    <span aria-hidden className="text-separator">
      &bull;
    </span>
  );
}
