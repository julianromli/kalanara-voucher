import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ServicesClient } from "./services-client";
import { ToastProvider } from "@/context/ToastContext";
import type { ServiceWithCategory } from "@/lib/actions/services";
import type { Database } from "@/lib/database.types";
import userEvent from "@testing-library/user-event";
import { createServiceCategory, updateServiceCategory, deleteServiceCategory } from "@/lib/actions/service-categories";

type ServiceCategoryRow = Database["public"]["Tables"]["service_categories"]["Row"];

const push = vi.fn();
const {
  authState,
  startUploadMock,
  deleteServiceImageByUrlMock,
} = vi.hoisted(() => ({
  authState: { role: "SUPER_ADMIN" as "SUPER_ADMIN" | "MANAGER" },
  startUploadMock: vi.fn(),
  deleteServiceImageByUrlMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { email: "admin@kalanaraspa.com", role: authState.role },
  }),
}));

vi.mock("@/components/admin/dashboard-header", () => ({
  DashboardHeader: () => <div data-testid="dashboard-header" />,
}));

// Mock server actions
vi.mock("@/lib/actions/service-categories", () => ({
  createServiceCategory: vi.fn(),
  updateServiceCategory: vi.fn(),
  deleteServiceCategory: vi.fn(),
}));

vi.mock("@/lib/uploadthing-client", () => ({
  useUploadThing: () => ({
    startUpload: startUploadMock,
    isUploading: false,
  }),
}));

vi.mock("@/lib/actions/service-images", () => ({
  deleteServiceImageByUrl: deleteServiceImageByUrlMock,
}));

// Mock service server actions
vi.mock("@/lib/actions/services", () => ({
  createService: vi.fn(),
  updateService: vi.fn(),
  setServiceActiveState: vi.fn(),
}));

// Mock service image utils
vi.mock("@/lib/utils/serviceImages", () => ({
  getAllowedServiceImageTypes: () => ["image/jpeg", "image/png", "image/webp"],
  getMaxServiceImageSizeBytes: () => 5 * 1024 * 1024,
  hasServiceImage: (imageUrl: string | null | undefined) => Boolean(imageUrl?.trim()),
  resolveServiceImageUrl: (imageUrl: string | null | undefined) =>
    imageUrl?.trim() ||
    "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80",
}));


const mockCategories: ServiceCategoryRow[] = [
  {
    id: "cat-1",
    name: "Body Treatment",
    slug: "body-treatment",
    sort_order: 1,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "cat-2",
    name: "Reflexology",
    slug: "reflexology",
    sort_order: 2,
    is_active: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "cat-3",
    name: "Custom Treatment",
    slug: "custom-treatment",
    sort_order: 3,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const mockServices: ServiceWithCategory[] = [
  {
    id: "test-id-1",
    name: "Balinese Lulur",
    description: "Traditional balinese lulur",
    duration: 60,
    price: 150000,
    category: "MASSAGE",
    category_id: "cat-2", // intentionally linked to inactive
    category_relation: mockCategories[1],
    image_url: "https://images.unsplash.com/photo-1507652313519-d4e9174996dd?w=800&q=80",
    is_active: true,
    scalev_product_id: null,
    scalev_variant_id: null,
    scalev_variant_unique_id: null,
    scalev_sync_status: null,
    scalev_last_synced_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const serviceWithoutImage: ServiceWithCategory = {
  ...mockServices[0],
  id: "test-id-3",
  name: "Service Tanpa Gambar",
  image_url: null,
};

const inactiveService: ServiceWithCategory = {
  ...mockServices[0],
  id: "test-id-2",
  name: "Deep Sleep",
  is_active: false,
};

class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.IntersectionObserver = MockIntersectionObserver as unknown as typeof window.IntersectionObserver;
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = MockResizeObserver;

class MockPointerEvent extends Event {
  button: number;
  ctrlKey: boolean;
  pointerType: string;

  constructor(type: string, props: PointerEventInit) {
    super(type, props);
    this.button = props.button || 0;
    this.ctrlKey = props.ctrlKey || false;
    this.pointerType = props.pointerType || "mouse";
  }
}
window.PointerEvent = MockPointerEvent as unknown as typeof PointerEvent;


describe("ServicesClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.role = "SUPER_ADMIN";
    startUploadMock.mockResolvedValue([
      {
        ufsUrl: "https://app-id.ufs.sh/f/service-image-key.webp",
      },
    ]);
    deleteServiceImageByUrlMock.mockResolvedValue({ success: true });
    URL.createObjectURL = vi.fn(() => "blob:preview-image");
    URL.revokeObjectURL = vi.fn();
  });

  const renderComponent = (services: ServiceWithCategory[] = mockServices) => {
    return render(
      <ToastProvider>
        <ServicesClient initialServices={services} initialCategories={mockCategories} />
      </ToastProvider>
    );
  };

  it("renders services with dynamic categories", () => {
    renderComponent();
    expect(screen.getByText("Kelola Kategori")).toBeInTheDocument();
    expect(screen.getByText("Balinese Lulur")).toBeInTheDocument();
    expect(screen.getAllByText("Reflexology").length).toBeGreaterThan(0);
  });

  it("handles add-category flow", async () => {
    const user = userEvent.setup();
    renderComponent();

    const manageCatBtn = screen.getByRole("button", { name: /Buka atau tutup kategori/i });
    await user.click(manageCatBtn);
    
    const addCatBtn = await screen.findByRole("button", { name: /Tambah Kategori/i });
    await user.click(addCatBtn);

    const input = await screen.findByPlaceholderText(/Misal:/i);
    await user.type(input, "New Category");

    vi.mocked(createServiceCategory).mockResolvedValue({
      id: "cat-new",
      name: "New Category",
      slug: "new-category",
      is_active: true,
      sort_order: 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
  });

    const saveBtn = screen.getByRole("button", { name: /Simpan/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(createServiceCategory).toHaveBeenCalledWith({ name: "New Category", isActive: true });
  });
    
    expect(await screen.findByRole("cell", { name: "New Category" })).toBeInTheDocument();
  });

  it("handles rename-category flow", async () => {
    const user = userEvent.setup();
    renderComponent();

    const manageCatBtn = screen.getByRole("button", { name: /Buka atau tutup kategori/i });
    await user.click(manageCatBtn);

    const editBtns = await screen.findAllByTitle("Edit Kategori");
    await user.click(editBtns[0]); 

    const input = await screen.findByPlaceholderText(/Misal:/i);
    await user.clear(input);
    await user.type(input, "Renamed Category");

    vi.mocked(updateServiceCategory).mockResolvedValue({
      ...mockCategories[0],
      name: "Renamed Category",
  });

    const saveBtn = screen.getByRole("button", { name: /Simpan/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(updateServiceCategory).toHaveBeenCalledWith("cat-1", { name: "Renamed Category" });
  });
    
    expect(await screen.findByText("Renamed Category")).toBeInTheDocument();
  });

  it("handles deactivate/reactivate-category flow", async () => {
    const user = userEvent.setup();
    renderComponent();

    const manageCatBtn = screen.getByRole("button", { name: /Buka atau tutup kategori/i });
    await user.click(manageCatBtn);

    const toggleBtns = await screen.findAllByRole("button", { name: /Nonaktifkan|Aktifkan/i });
    
    vi.mocked(updateServiceCategory).mockResolvedValue({
      ...mockCategories[0],
      is_active: false,
  });
    
    await user.click(toggleBtns[0]);

    await waitFor(() => {
      expect(updateServiceCategory).toHaveBeenCalledWith("cat-1", { 
        name: "Body Treatment", 
        isActive: false 
    });
  });
  });

  it("handles delete rejection for referenced category", async () => {
    const user = userEvent.setup();
    window.confirm = vi.fn().mockReturnValue(true);
    
    renderComponent();

    const manageCatBtn = screen.getByRole("button", { name: /Buka atau tutup kategori/i });
    await user.click(manageCatBtn);

    const deleteBtns = await screen.findAllByTitle("Hapus Kategori");
    
    vi.mocked(deleteServiceCategory).mockRejectedValue(new Error("Kategori ini sedang digunakan oleh 1 layanan"));
    
    await user.click(deleteBtns[1]); 

    await waitFor(() => {
      expect(deleteServiceCategory).toHaveBeenCalledWith("cat-2");
  });
    
    expect(await screen.findByText(/Kategori ini sedang digunakan/i)).toBeInTheDocument();
});


  it("preserves inactive categories in edit mode but excludes from new assignment", async () => {
    const user = userEvent.setup();
    renderComponent();

    // 1. Check Create mode: inactive category should be excluded
    const addServiceBtn = screen.getByRole("button", { name: /Tambah Layanan/i });
    await user.click(addServiceBtn);

    const createDialogTitle = await screen.findByText("Tambah Layanan Baru");
    expect(createDialogTitle).toBeInTheDocument();

    const categorySelectBtn = screen.getAllByRole("combobox")[0]; // There could be multiple, but we want the one in the modal
    await user.click(categorySelectBtn);

    // active category is an option
    const activeOption = await screen.findByRole("option", { name: /Body Treatment/i });
    expect(activeOption).toBeInTheDocument();
    
    // inactive category is NOT an option in create mode
    const inactiveOptionQuery = screen.queryByRole("option", { name: /Reflexology/i });
    expect(inactiveOptionQuery).not.toBeInTheDocument();

    // Close select dropdown before trying to find Cancel button
    // Pressing escape closes the dropdown
    await user.keyboard("{Escape}");

    // Close create dialog
    const cancelBtn = await screen.findByRole("button", { name: /Batal/i });
    await user.click(cancelBtn);
    
    await waitFor(() => {
      expect(screen.queryByText("Tambah Layanan Baru")).not.toBeInTheDocument();
  });

    // 2. Check Edit mode: inactive category SHOULD be preserved if already selected
    // Note: We need to target the edit button specifically for the service table row.
    // Given our mock, we just have one service row.
    const editServiceBtn = screen.getByRole("button", { name: /Ubah Balinese Lulur/i });
    await user.click(editServiceBtn); 

    const editDialogTitle = await screen.findByText("Ubah Layanan");
    expect(editDialogTitle).toBeInTheDocument();

    // The combobox should show the currently selected inactive category name
    const editCategorySelectBtn = screen.getAllByRole("combobox")[0];
    expect(editCategorySelectBtn).toHaveTextContent("Reflexology (Nonaktif)");

    await user.click(editCategorySelectBtn);

    // Both should be in the list now
    expect(await screen.findByRole("option", { name: /Body Treatment/i })).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: /Reflexology \(Nonaktif\)/i })).toBeInTheDocument();

  });

  it("toggles service active state from the service card", async () => {
    const user = userEvent.setup();
    renderComponent();

    const { setServiceActiveState } = await import("@/lib/actions/services");
    vi.mocked(setServiceActiveState).mockResolvedValue({
      ...mockServices[0],
      is_active: false,
    });

    const toggleBtn = screen.getByRole("button", { name: /Nonaktifkan Balinese Lulur/i });
    await user.click(toggleBtn);

    await waitFor(() => {
      expect(setServiceActiveState).toHaveBeenCalledWith("test-id-1", false);
    });

    expect(await screen.findByText("Nonaktif")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Aktifkan Balinese Lulur/i })).toBeInTheDocument();
  });

  it("reactivates an inactive service from the service card", async () => {
    const user = userEvent.setup();
    renderComponent([inactiveService]);

    const { setServiceActiveState } = await import("@/lib/actions/services");
    vi.mocked(setServiceActiveState).mockResolvedValue({
      ...inactiveService,
      is_active: true,
    });

    const toggleBtn = screen.getByRole("button", { name: /Aktifkan Deep Sleep/i });
    await user.click(toggleBtn);

    await waitFor(() => {
      expect(setServiceActiveState).toHaveBeenCalledWith("test-id-2", true);
    });

    expect(await screen.findByText("Aktif")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nonaktifkan Deep Sleep/i })).toBeInTheDocument();
  });

  it("blocks creating a service when no image is uploaded", async () => {
    const user = userEvent.setup();
    renderComponent();

    const { createService } = await import("@/lib/actions/services");

    await user.click(screen.getByRole("button", { name: /Tambah Layanan/i }));

    fireEvent.change(screen.getByLabelText("Nama Layanan *"), {
      target: { value: "Service Baru" },
    });
    fireEvent.change(screen.getByLabelText(/Price \(IDR\) \*/), {
      target: { value: "200000" },
    });

    await user.click(screen.getByRole("button", { name: /Buat Layanan/i }));

    expect(createService).not.toHaveBeenCalled();
    expect(
      await screen.findAllByText("Gambar layanan wajib diunggah sebelum layanan disimpan.")
    ).not.toHaveLength(0);
  });

  it("blocks editing a service when the record still has no image", async () => {
    const user = userEvent.setup();
    renderComponent([serviceWithoutImage]);

    const { updateService } = await import("@/lib/actions/services");

    await user.click(screen.getByRole("button", { name: /Ubah Service Tanpa Gambar/i }));
    await user.click(await screen.findByRole("button", { name: /Simpan Perubahan/i }));

    expect(updateService).not.toHaveBeenCalled();
    expect(
      await screen.findAllByText("Gambar layanan wajib diunggah sebelum layanan disimpan.")
    ).not.toHaveLength(0);
  });

  it("hides create and image mutation controls for managers", async () => {
    const user = userEvent.setup();
    authState.role = "MANAGER";
    renderComponent();

    expect(screen.queryByRole("button", { name: /Tambah Layanan/i })).not.toBeInTheDocument();
    expect(
      screen.getByText(/Penambahan layanan baru dan perubahan gambar hanya tersedia untuk super admin/i)
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Ubah Balinese Lulur/i }));

    expect(screen.queryByLabelText("Gambar Layanan")).not.toBeInTheDocument();
    expect(
      screen.getByText(/perubahan gambar hanya dapat dilakukan oleh super admin/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Hapus Gambar/i })).not.toBeInTheDocument();
  });

  it("cleans up a freshly uploaded image when service save fails", async () => {
    const user = userEvent.setup();
    renderComponent();

    const { createService } = await import("@/lib/actions/services");
    vi.mocked(createService).mockRejectedValue(new Error("Gagal membuat layanan."));

    await user.click(screen.getByRole("button", { name: /Tambah Layanan/i }));

    fireEvent.change(screen.getByLabelText("Nama Layanan *"), {
      target: { value: "Service Baru" },
    });
    fireEvent.change(screen.getByLabelText(/Price \(IDR\) \*/), {
      target: { value: "200000" },
    });

    const categorySelectBtn = screen.getAllByRole("combobox")[0];
    await user.click(categorySelectBtn);
    await user.click(await screen.findByRole("option", { name: /Body Treatment/i }));

    const fileInput = screen.getByLabelText("Gambar Layanan");
    const file = new File(["spa"], "service.jpg", { type: "image/jpeg" });
    await user.upload(fileInput, file);

    await user.click(screen.getByRole("button", { name: /Buat Layanan/i }));

    await waitFor(() => {
      expect(deleteServiceImageByUrlMock).toHaveBeenCalledWith(
        "https://app-id.ufs.sh/f/service-image-key.webp"
      );
    });
  });

  it("submits correct payload when creating and updating a service", async () => {
    const user = userEvent.setup();
    renderComponent();

    // 1. CREATE SERVICE
    const addServiceBtn = screen.getByRole("button", { name: /Tambah Layanan/i });
    await user.click(addServiceBtn);

    // Fill form
    const nameInput = screen.getByLabelText("Nama Layanan *");
    fireEvent.change(nameInput, { target: { value: "New Facial Service" } });

    const priceInput = screen.getByLabelText("Price (IDR) *");
    fireEvent.change(priceInput, { target: { value: "150000" } });

    const durationInput = screen.getByLabelText("Durasi (menit) *");
    fireEvent.change(durationInput, { target: { value: "60" } });

    // Select category
    const categorySelectBtn = screen.getAllByRole("combobox")[0];
    await user.click(categorySelectBtn);
    const activeOption = await screen.findByRole("option", { name: /Body Treatment/i });
    await user.click(activeOption);

    const fileInput = screen.getByLabelText("Gambar Layanan");
    const file = new File(["spa"], "service.jpg", { type: "image/jpeg" });
    await user.upload(fileInput, file);

    // Mock createService
    const { createService } = await import("@/lib/actions/services");
    vi.mocked(createService).mockResolvedValue({
      id: "srv-new",
      name: "New Facial Service",
      description: null,
      duration: 60,
      price: 150000,
      category: "BODY_TREATMENT", // Derived from "Lulur"
      category_id: "cat-1",
      image_url:
          "https://app-id.ufs.sh/f/service-image-key.webp",
      is_active: true,
      scalev_product_id: null,
      scalev_variant_id: null,
      scalev_variant_unique_id: null,
      scalev_sync_status: 'SYNCED',
      scalev_last_synced_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      category_relation: mockCategories[0]
    });

    const saveBtn = screen.getByRole("button", { name: /Buat Layanan/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(createService).toHaveBeenCalledWith(expect.objectContaining({
        name: "New Facial Service",
        price: 150000,
        duration: 60,
        category: "BODY_TREATMENT",
        category_id: "cat-1",
        image_url: "https://app-id.ufs.sh/f/service-image-key.webp",
      }));
    });

    // 2. UPDATE SERVICE
    const editBtns = screen.getAllByRole("button", { name: /Ubah Balinese Lulur/i });
    await user.click(editBtns[0]);

    // Change category to Lulur
    const editCategorySelectBtn = screen.getAllByRole("combobox")[0];
    await user.click(editCategorySelectBtn);
    const lulurOption = await screen.findByRole("option", { name: /Body Treatment/i });
    await user.click(lulurOption);
    
    const editSaveBtn = await screen.findByRole("button", { name: /Simpan Perubahan/i });
    
    const { updateService } = await import("@/lib/actions/services");
    vi.mocked(updateService).mockResolvedValue({
      ...mockServices[0],
      category_id: "cat-1",
      category: "BODY_TREATMENT"
    });

    await user.click(editSaveBtn);

    await waitFor(() => {
      expect(updateService).toHaveBeenCalledWith("test-id-1", expect.objectContaining({
        name: "Balinese Lulur", 
        category: "BODY_TREATMENT", 
        category_id: "cat-1"
      }));
    });
    // 3. UPDATE SERVICE TO CUSTOM CATEGORY
    const editBtnsAgain = screen.getAllByRole("button", { name: /Ubah Balinese Lulur/i });
    await user.click(editBtnsAgain[0]);

    // Change category to Custom Treatment
    const customCategorySelectBtn = screen.getAllByRole("combobox")[0];
    await user.click(customCategorySelectBtn);
    const customOption = await screen.findByRole("option", { name: /Custom Treatment/i });
    await user.click(customOption);
    
    const customSaveBtn = await screen.findByRole("button", { name: /Simpan Perubahan/i });
    
    vi.mocked(updateService).mockResolvedValue({
      ...mockServices[0],
      category_id: "cat-3",
      category: "BODY_TREATMENT"
    });

    await user.click(customSaveBtn);

    await waitFor(() => {
      expect(updateService).toHaveBeenCalledWith("test-id-1", expect.objectContaining({
        name: "Balinese Lulur", 
        category: "BODY_TREATMENT", // Should preserve the legacy category from step 2
        category_id: "cat-3"
      }));
    });
  });
});
