import { AddressForm } from "../shared";
export default function Lookup() {
  return (
    <>
      <h1>Look up a report</h1>
      <p className="intro">
        Read the attester’s commitment, import its evidence and replay the
        original snapshot.
      </p>
      <AddressForm action="lookup" />
    </>
  );
}
