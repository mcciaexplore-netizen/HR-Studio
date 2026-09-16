/** The unmodified logo downloaded from MCCIA's official website. */
export function BrandMark() {
  return (
    <div className="brand-mark">
      <div className="brand-logo">
        <img
          src="/branding/mccia/logo.png"
          alt="MCCIA"
          width={268}
          height={73}
          className="brand-image"
        />
      </div>
      <span className="brand-product">
        HR Studio<span>People & workplace</span>
      </span>
    </div>
  );
}
