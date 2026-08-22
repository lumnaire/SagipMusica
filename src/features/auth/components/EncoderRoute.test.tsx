import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { useAuthStore } from "@/stores/auth-store";
import { EncoderRoute } from "./EncoderRoute";
import type { Profile } from "@/types/database";

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={["/encoder"]}>
      <Routes>
        <Route
          path="/encoder"
          element={
            <EncoderRoute>
              <div>library editor</div>
            </EncoderRoute>
          }
        />
        <Route path="/login" element={<div>login page</div>} />
        <Route path="/dashboard" element={<div>dashboard page</div>} />
        <Route path="/onboarding" element={<div>onboarding page</div>} />
        <Route path="/superadmin" element={<div>superadmin page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function signIn(role: Profile["role"], church_id: string | null) {
  useAuthStore.setState({
    status: "authenticated",
    session: { user: { email: "u@example.com" } } as never,
    profile: {
      id: "u1",
      church_id,
      email: "u@example.com",
      name: null,
      role,
      onboarding_completed: church_id !== null,
    } as Profile,
  });
}

describe("EncoderRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /login when unauthenticated", () => {
    useAuthStore.setState({ status: "unauthenticated", session: null, profile: null });
    renderGuard();

    expect(screen.getByText("login page")).toBeInTheDocument();
    expect(screen.queryByText("library editor")).not.toBeInTheDocument();
  });

  it("renders the editor for an encoder", () => {
    signIn("encoder", null);
    renderGuard();

    expect(screen.getByText("library editor")).toBeInTheDocument();
  });

  it("sends a church admin back to their dashboard", () => {
    signIn("admin", "church-1");
    renderGuard();

    expect(screen.getByText("dashboard page")).toBeInTheDocument();
    expect(screen.queryByText("library editor")).not.toBeInTheDocument();
  });

  it("sends a presenter with no church to onboarding, not the editor", () => {
    signIn("presenter", null);
    renderGuard();

    expect(screen.getByText("onboarding page")).toBeInTheDocument();
    expect(screen.queryByText("library editor")).not.toBeInTheDocument();
  });

  it("sends a superadmin to their own area", () => {
    signIn("superadmin", null);
    renderGuard();

    expect(screen.getByText("superadmin page")).toBeInTheDocument();
    expect(screen.queryByText("library editor")).not.toBeInTheDocument();
  });
});
