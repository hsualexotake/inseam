import Image from "next/image";
import Link from "next/link";
import React from "react";

interface Props {
  isMobile?: boolean;
}

const Logo = ({ isMobile }: Props) => {
  return (
    <Link href={"/"}>
      <div className="flex gap-2 items-center">
        <Image src={"/images/combologo.png"} width={32} height={32} alt="logo" className="object-contain" />
        {!isMobile ? (
          <h1 className="logofont text-black text-3xl sm:text-[35px] not-italic">
            inseam
          </h1>
        ) : null}
      </div>
    </Link>
  );
};

export default Logo;
