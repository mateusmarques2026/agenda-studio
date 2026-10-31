import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import Agenda from "@/app/agenda";
import Customer from "@/app/cliente/customer";
import "@/app/globals.css";
import DemoToolbar from "./toolbar";
import { handleLinks, installDemoApi } from "./runtime";
import { handle, role, store } from "./api";
installDemoApi(handle);
handleLinks((path) => {
  location.hash = path === "/admin" ? "admin" : "cliente";
});
function Demo() {
  const [current, setCurrent] = useState(role);
  useEffect(() => {
    const update = () => setCurrent(role());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  const identity = {
    name: current === "admin" ? "Mateus · demonstração" : "Marina · demonstração",
    email: current === "admin" ? "dono@example.com" : "marina@example.com",
    local: true,
  };
  return (
    <>
      <DemoToolbar
        repo="agenda-studio"
        role={current}
        roles={[
          ["cliente", "Visão do cliente"],
          ["admin", "Visão do dono"],
        ]}
        onRole={(value) => {
          location.hash = value;
        }}
        onReset={() => {
          store.reset();
          location.reload();
        }}
      />
      {current === "admin" ? (
        <Agenda identity={identity} />
      ) : (
        <Customer
          displayName={identity.name}
          admin={false}
          restricted={false}
          identity={identity}
        />
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Demo />);
