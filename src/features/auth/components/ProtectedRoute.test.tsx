import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import { ProtectedRoute } from "./ProtectedRoute";
import type { Profile } from "@/types/database";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderAt(path: string, requireRole?: Profile["role"], requireChurch?: boolean) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/protected"
          element={
            <ProtectedRoute requireRole={requireRole} requireChurch={requireChurch}>
              <div>secret content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/dashboard" element={<div>dashboard page</div>} />
        <Route path="/login" element={<div>login page</div>} />
        <Route path="/onboarding" element={<div>onboarding page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /login when unauthenticated", () => {
    useAuthStore.setState({ status: "unauthenticated", session: null, profile: null });
    renderAt("/protected");

    expect(screen.getByText("login page")).toBeInTheDocument();
    expect(screen.queryByText("secret content")).not.toBeInTheDocument();
  });

  it("redirects a presenter away from an admin-only route and warns them", () => {
    useAuthStore.setState({
      status: "authenticated",
      session: { user: { email: "p@church.org" } } as never,
      profile: {
        id: "u1",
        church_id: "church-1",
        email: "p@church.org",
        name: null,
        role: "presenter",
        onboarding_completed: true,
      } as Profile,
    });
    renderAt("/protected", "admin");

    expect(screen.getByText("dashboard page")).toBeInTheDocument();
    expect(screen.queryByText("secret content")).not.toBeInTheDocument();
    expect(toast.error).toHaveBeenCalled();
  });

  it("renders the protected content for an admin on an admin-only route", () => {
    useAuthStore.setState({
      status: "authenticated",
      session: { user: { email: "a@church.org" } } as never,
      profile: {
        id: "u2",
        church_id: "church-1",
        email: "a@church.org",
        name: null,
        role: "admin",
        onboarding_completed: true,
      } as Profile,
    });
    renderAt("/protected", "admin");

    expect(screen.getByText("secret content")).toBeInTheDocument();
  });

  it("renders the protected content for a presenter when no role is required", () => {
    useAuthStore.setState({
      status: "authenticated",
      session: { user: { email: "p@church.org" } } as never,
      profile: {
        id: "u1",
        church_id: "church-1",
        email: "p@church.org",
        name: null,
        role: "presenter",
        onboarding_completed: true,
      } as Profile,
    });
    renderAt("/protected");

    expect(screen.getByText("secret content")).toBeInTheDocument();
  });

  it("redirects to /onboarding when the user has no church yet", () => {
    useAuthStore.setState({
      status: "authenticated",
      session: { user: { email: "new@church.org" } } as never,
      profile: {
        id: "u3",
        church_id: null,
        email: "new@church.org",
        name: null,
        role: "presenter",
        onboarding_completed: false,
      } as Profile,
    });
    renderAt("/protected");

    expect(screen.getByText("onboarding page")).toBeInTheDocument();
    expect(screen.queryByText("secret content")).not.toBeInTheDocument();
  });

  it("does not redirect to /onboarding when requireChurch is false", () => {
    useAuthStore.setState({
      status: "authenticated",
      session: { user: { email: "new@church.org" } } as never,
      profile: {
        id: "u3",
        church_id: null,
        email: "new@church.org",
        name: null,
        role: "presenter",
        onboarding_completed: false,
      } as Profile,
    });
    renderAt("/protected", undefined, false);

    expect(screen.getByText("secret content")).toBeInTheDocument();
  });
});
