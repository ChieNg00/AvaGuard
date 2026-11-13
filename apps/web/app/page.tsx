import { AddressForm } from "./shared";
export default function Scan() {
  return (
    <>
      <h1>Scan a contract</h1>
      <p className="intro">
        Inspect ERC-20 risk signals at one reproducible block. Scanning works
        without a wallet.
      </p>
      <AddressForm action="scan" />
    </>
  );
}
