import Image from "next/image";

/** Soft, low-opacity venue photo behind the hero — decorative only. */
export function VenueBackdrop() {
  return (
    <div className="venue-backdrop">
      <Image
        src="/images/venue.webp"
        alt=""
        aria-hidden="true"
        fill
        priority
        sizes="100vw"
      />
    </div>
  );
}
