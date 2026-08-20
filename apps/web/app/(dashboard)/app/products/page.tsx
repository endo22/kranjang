"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, api, jsonInit } from "@/lib/api";
import { formatRp } from "@/lib/format";
import {
  buildProductPayload,
  buildRecipePayload,
  createEmptyProductForm,
  toProductFormState,
  type ProductDetail,
  type ProductFormState,
  type ProductType,
  type RecipeDraftItem,
} from "./product-form";

type Product = ProductDetail & {
  category: { id: string; name: string } | null;
};

type Category = { id: string; name: string; sortOrder?: number };
type ProductFilters = { q: string; productType: string; categoryId: string };

function createEmptyRecipeDraft(): RecipeDraftItem {
  return { ingredientId: "", quantity: "1" };
}

function buildProductsPath(filters: ProductFilters) {
  const params = new URLSearchParams();
  const q = filters.q.trim();
  if (q) {
    params.set("q", q);
  }
  if (filters.productType) {
    params.set("productType", filters.productType);
  }
  if (filters.categoryId) {
    params.set("categoryId", filters.categoryId);
  }

  const query = params.toString();
  return query ? `/products?${query}` : "/products";
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [visibleProducts, setVisibleProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormState>(createEmptyProductForm);
  const [recipeItems, setRecipeItems] = useState<RecipeDraftItem[]>([createEmptyRecipeDraft()]);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<ProductFilters>({ q: "", productType: "", categoryId: "" });

  async function load(nextFilters: ProductFilters = filters) {
    const productsPath = buildProductsPath(nextFilters);
    const [nextVisibleProducts, nextAllProducts, nextCategories] = await Promise.all([
      api<Product[]>(productsPath),
      productsPath === "/products" ? Promise.resolve<Product[] | null>(null) : api<Product[]>("/products"),
      api<Category[]>("/categories"),
    ]);
    setVisibleProducts(nextVisibleProducts);
    setProducts(nextAllProducts ?? nextVisibleProducts);
    setCategories(nextCategories);
    setCategoryDrafts(Object.fromEntries(nextCategories.map((category) => [category.id, category.name])));
  }

  useEffect(() => {
    void load().catch((error) => toast.error(error instanceof ApiError ? error.message : "Gagal memuat produk."));
  }, []);

  const ingredientOptions = useMemo(
    () => products.filter((product) => product.id !== editingId && product.productType !== "RECIPE"),
    [editingId, products],
  );

  function setFormField<Key extends keyof ProductFormState>(key: Key, value: ProductFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function setFilterField<Key extends keyof ProductFilters>(key: Key, value: ProductFilters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetEditor() {
    setEditingId(null);
    setForm(createEmptyProductForm());
    setRecipeItems([createEmptyRecipeDraft()]);
  }

  function applyDetailToEditor(product: ProductDetail) {
    setEditingId(product.id);
    setForm(toProductFormState(product));
    setRecipeItems(
      product.recipe.length
        ? product.recipe.map((item) => ({
            ingredientId: item.ingredientId,
            quantity: String(item.quantity),
          }))
        : [createEmptyRecipeDraft()],
    );
  }

  async function editProduct(id: string) {
    const detail = await api<ProductDetail>(`/products/${id}`);
    applyDetailToEditor(detail);
  }

  async function addCategory() {
    await api("/categories", { method: "POST", ...jsonInit({ name: categoryName }) });
    setCategoryName("");
    await load();
  }

  async function saveCategory(id: string) {
    const category = categories.find((item) => item.id === id);
    if (!category) {
      return;
    }

    const name = (categoryDrafts[id] ?? category.name).trim();
    await api(`/categories/${id}`, {
      method: "PATCH",
      ...jsonInit({ name, sortOrder: category.sortOrder ?? 0 }),
    });
    await load();
  }

  async function deleteCategory(id: string) {
    await api(`/categories/${id}`, { method: "DELETE" });
    await load();
  }

  async function saveProduct() {
    const payload = buildProductPayload(form);
    const saved = editingId
      ? await api<ProductDetail>(`/products/${editingId}`, {
          method: "PATCH",
          ...jsonInit(payload),
        })
      : await api<ProductDetail>("/products", {
          method: "POST",
          ...jsonInit(payload),
        });
    await load();
    applyDetailToEditor(saved);
  }

  async function deactivateProduct(product: Product) {
    if (!product.isActive) {
      return;
    }

    if (typeof window !== "undefined" && !window.confirm(`Nonaktifkan produk "${product.name}"?`)) {
      return;
    }

    await api<ProductDetail>(`/products/${product.id}`, {
      method: "PATCH",
      ...jsonInit({ isActive: false }),
    });
    if (editingId === product.id) {
      setFormField("isActive", false);
    }
    await load();
  }

  async function saveRecipe() {
    if (!editingId) {
      return;
    }

    const payload = buildRecipePayload(recipeItems);
    if (payload.items.length === 0) {
      toast.error("Tambahkan minimal satu bahan dengan qty lebih dari 0.");
      return;
    }

    const saved = await api<ProductDetail>(`/products/${editingId}/recipe`, {
      method: "PUT",
      ...jsonInit(payload),
    });
    await load();
    applyDetailToEditor(saved);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Produk</CardTitle>
          <CardDescription>Kelola SIMPLE, INGREDIENT, dan RECIPE beserta barcode, stok minimum, gambar, dan BOM.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void addCategory()
                  .then(() => toast.success("Kategori ditambahkan."))
                  .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal menambah kategori."));
              }}
            >
              <Label>Kategori baru</Label>
              <Input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} required minLength={2} />
              <Button type="submit">Tambah kategori</Button>
            </form>
            <div className="space-y-3">
              <p className="text-sm font-medium">Kategori</p>
              {categories.length === 0 ? <p className="text-sm text-[#616161]">Belum ada kategori.</p> : null}
              {categories.map((category) => (
                <div key={category.id} className="grid gap-2 rounded-2xl border border-[#e5e7eb] p-3 sm:grid-cols-[1fr_auto_auto]">
                  <Input
                    value={categoryDrafts[category.id] ?? category.name}
                    onChange={(event) =>
                      setCategoryDrafts((current) => ({
                        ...current,
                        [category.id]: event.target.value,
                      }))
                    }
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void saveCategory(category.id)
                        .then(() => toast.success("Kategori diperbarui."))
                        .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal memperbarui kategori."));
                    }}
                  >
                    Simpan
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      void deleteCategory(category.id)
                        .then(() => toast.success("Kategori dihapus."))
                        .catch((error) =>
                          toast.error(error instanceof Error ? error.message : "Kategori gagal dihapus."),
                        );
                    }}
                  >
                    Hapus
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void saveProduct()
                .then(() => toast.success(editingId ? "Produk diperbarui." : "Produk ditambahkan."))
                .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal menyimpan produk."));
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>{editingId ? "Edit produk" : "Produk baru"}</Label>
                <p className="text-sm text-[#616161]">
                  {editingId ? "Perbarui detail, status aktif, dan lanjut edit BOM bila perlu." : "Buat produk baru lebih dulu sebelum mengisi BOM."}
                </p>
              </div>
              {editingId ? (
                <Button type="button" variant="outline" onClick={resetEditor}>
                  Batal edit
                </Button>
              ) : null}
            </div>
            <Label>Nama produk</Label>
            <Input value={form.name} onChange={(event) => setFormField("name", event.target.value)} required />
            <Label>Tipe</Label>
            <select
              className="h-11 w-full rounded-2xl border border-[#e5e7eb] px-3"
              value={form.productType}
              onChange={(event) => setFormField("productType", event.target.value as ProductType)}
            >
              <option value="SIMPLE">SIMPLE</option>
              <option value="INGREDIENT">INGREDIENT</option>
              <option value="RECIPE">RECIPE</option>
            </select>
            <Label>Satuan</Label>
            <Input value={form.unit} onChange={(event) => setFormField("unit", event.target.value)} required />
            <Label>Harga jual</Label>
            <Input type="number" min={0} value={form.sellPrice} onChange={(event) => setFormField("sellPrice", event.target.value)} />
            <Label>Harga beli / modal</Label>
            <Input type="number" min={0} value={form.buyPrice} onChange={(event) => setFormField("buyPrice", event.target.value)} />
            <Label>Kategori</Label>
            <select
              className="h-11 w-full rounded-2xl border border-[#e5e7eb] px-3"
              value={form.categoryId}
              onChange={(event) => setFormField("categoryId", event.target.value)}
            >
              <option value="">Tanpa kategori</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <Label>Barcode</Label>
            <Input value={form.barcode} onChange={(event) => setFormField("barcode", event.target.value)} />
            <Label>Minimum stok</Label>
            <Input type="number" min={0} value={form.minStock} onChange={(event) => setFormField("minStock", event.target.value)} />
            <Label>URL gambar</Label>
            <Input type="url" value={form.imageUrl} onChange={(event) => setFormField("imageUrl", event.target.value)} placeholder="https://..." />
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setFormField("isActive", event.target.checked)}
              />
              Produk aktif
            </label>
            <Button type="submit">{editingId ? "Simpan perubahan" : "Simpan produk"}</Button>
            {form.productType === "RECIPE" && !editingId ? (
              <p className="text-sm text-[#616161]">Simpan produk RECIPE dulu, lalu isi BOM di mode edit.</p>
            ) : null}
          </form>
        </CardContent>
      </Card>
      {editingId && form.productType === "RECIPE" ? (
        <Card>
          <CardHeader>
            <CardTitle>BOM / Resep</CardTitle>
            <CardDescription>Pilih bahan SIMPLE atau INGREDIENT dan isi kuantitas per porsi.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recipeItems.map((item, index) => (
              <div key={`${item.ingredientId}-${index}`} className="grid gap-3 lg:grid-cols-[1fr_180px_auto]">
                <select
                  className="h-11 rounded-2xl border border-[#e5e7eb] px-3"
                  value={item.ingredientId}
                  onChange={(event) =>
                    setRecipeItems((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, ingredientId: event.target.value } : row,
                      ),
                    )
                  }
                >
                  <option value="">Pilih bahan</option>
                  {ingredientOptions.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.unit})
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.quantity}
                  onChange={(event) =>
                    setRecipeItems((current) =>
                      current.map((row, rowIndex) => (rowIndex === index ? { ...row, quantity: event.target.value } : row)),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setRecipeItems((current) => (current.length === 1 ? [createEmptyRecipeDraft()] : current.filter((_, rowIndex) => rowIndex !== index)))
                  }
                >
                  Hapus
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={() => setRecipeItems((current) => [...current, createEmptyRecipeDraft()])}>
                Tambah bahan
              </Button>
              <Button
                type="button"
                onClick={() => {
                  void saveRecipe()
                    .then(() => toast.success("BOM diperbarui."))
                    .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal menyimpan BOM."));
                }}
              >
                Simpan BOM
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardContent className="p-0">
          <div className="border-b border-[#f3f3f3] p-4">
            <form
              className="grid gap-3 md:grid-cols-[minmax(0,2fr)_180px_220px_auto_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                void load(filters).catch((error) => toast.error(error instanceof Error ? error.message : "Gagal memuat produk."));
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="product-search">Cari produk</Label>
                <Input
                  id="product-search"
                  value={filters.q}
                  onChange={(event) => setFilterField("q", event.target.value)}
                  placeholder="Nama atau barcode"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-type-filter">Tipe</Label>
                <select
                  id="product-type-filter"
                  className="h-11 w-full rounded-2xl border border-[#e5e7eb] px-3"
                  value={filters.productType}
                  onChange={(event) => setFilterField("productType", event.target.value)}
                >
                  <option value="">Semua tipe</option>
                  <option value="SIMPLE">SIMPLE</option>
                  <option value="INGREDIENT">INGREDIENT</option>
                  <option value="RECIPE">RECIPE</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-category-filter">Kategori</Label>
                <select
                  id="product-category-filter"
                  className="h-11 w-full rounded-2xl border border-[#e5e7eb] px-3"
                  value={filters.categoryId}
                  onChange={(event) => setFilterField("categoryId", event.target.value)}
                >
                  <option value="">Semua kategori</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" className="self-end">
                Terapkan
              </Button>
              <Button
                type="button"
                variant="outline"
                className="self-end"
                onClick={() => {
                  const nextFilters = { q: "", productType: "", categoryId: "" };
                  setFilters(nextFilters);
                  void load(nextFilters).catch((error) => toast.error(error instanceof Error ? error.message : "Gagal memuat produk."));
                }}
              >
                Reset
              </Button>
            </form>
            <p className="mt-3 text-sm text-[#616161]">Menampilkan {visibleProducts.length} produk.</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[#616161]">
                <th className="px-4 py-3">Nama</th>
                <th>Tipe</th>
                <th>Harga jual</th>
                <th>Stok</th>
                <th>Min stok</th>
                <th>HPP</th>
                <th>Status</th>
                <th className="px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((product) => (
                <tr key={product.id} className="border-b border-[#f3f3f3]">
                  <td className="px-4 py-3">
                    <div className="font-medium">{product.name}</div>
                    <div className="text-xs text-[#616161]">
                      {product.category?.name ?? "Tanpa kategori"}
                      {product.barcode ? ` • ${product.barcode}` : ""}
                    </div>
                  </td>
                  <td>{product.productType}</td>
                  <td>{formatRp(product.sellPrice)}</td>
                  <td>{product.stock}</td>
                  <td>{product.minStock}</td>
                  <td>{formatRp(product.hpp)}</td>
                  <td>{product.isActive ? "Aktif" : "Nonaktif"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          void editProduct(product.id).catch((error) =>
                            toast.error(error instanceof Error ? error.message : "Gagal memuat detail produk."),
                          );
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={!product.isActive}
                        onClick={() => {
                          void deactivateProduct(product).catch((error) =>
                            toast.error(error instanceof Error ? error.message : "Gagal menonaktifkan produk."),
                          );
                        }}
                      >
                        Nonaktif
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {visibleProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-sm text-[#616161]">
                    Tidak ada produk yang cocok dengan filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
