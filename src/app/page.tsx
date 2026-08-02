import Image from "next/image";
import Link from "next/link";
import styles from "./home.module.css";

export default function Home() {
  return (
    <div>
      <h1>Rob&apos;s Fractals</h1>
      <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>
        Welcome to the home page.
      </p>
      <div className={styles.cards}>
        <Link href="/apex-fractal" className={styles.card}>
          <Image
            src="/apex-fractal-thumb.svg"
            alt="Apex Fractal thumbnail"
            width={320}
            height={220}
            className={styles.thumb}
          />
          <div className={styles.cardBody}>
            <div className={styles.cardTitle}>Apex Fractal</div>
            <div className={styles.cardDescription}>
              An interactive recursive generator, mapped to the complex plane and iterated in
              3D.
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
