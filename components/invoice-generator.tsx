"use client"

import type React from "react"

import { useState, useRef } from "react"
import { jsPDF } from "jspdf"
import html2canvas from "html2canvas"
import { v4 as uuidv4 } from "uuid"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import InvoiceForm from "@/components/invoice-form"
import InvoicePreview from "@/components/invoice-preview"
import type { InvoiceData } from "@/types/invoice"

export default function InvoiceGenerator() {
  const [activeTab, setActiveTab] = useState("edit")
  const invoiceRef = useRef<HTMLDivElement>(null)

  const [invoiceData, setInvoiceData] = useState<InvoiceData>({
    invoiceNumber: `INV-${Math.floor(Math.random() * 10000)}`,
    date: new Date().toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    companyName: "Pranay Enterprises",
    companyLogo: "/logo.png",
    companyDetails: "GST: 27AAJPT2871R1ZP\nState: Maharashtra",
    fromName: "Pranay Enterprises",
    fromEmail: "",
    fromAddress: "Satkar tower, Near Saket college\nKalyan East\nMaharashtra",
    toName: "",
    toEmail: "",
    toAddress: "",
    items: [
      {
        id: uuidv4(),
        description: "",
        quantity: 1,
        price: 0,
        currency: "INR",
        exchangeRate: 1,
        discountType: "percentage",
        discountValue: 0,
        taxRate: 18,
      },
    ],
    notes: "",
    currency: "INR",
    footer: "Thank you for your business!",
    discountType: "percentage",
    discountValue: 0,
    applyInvoiceDiscountToDiscountedItems: true,
  })

  const handleInvoiceChange = (field: string, value: string | number | boolean) => {
    if (field === "currency") {
      // When invoice currency changes, update all items with the same currency to have exchange rate 1
      const updatedItems = invoiceData.items.map((item) => {
        if (item.currency === invoiceData.currency) {
          return { ...item, currency: value as string, exchangeRate: 1 }
        }
        return item
      })
      setInvoiceData({ ...invoiceData, [field]: value, items: updatedItems })
    } else {
      setInvoiceData({ ...invoiceData, [field]: value })
    }
  }

  const handleItemChange = (id: string, field: string, value: string | number) => {
    const updatedItems = invoiceData.items.map((item) => {
      if (item.id === id) {
        if (field === "currency") {
          // If currency is changed to match invoice currency, reset exchange rate to 1
          const exchangeRate = value === invoiceData.currency ? 1 : item.exchangeRate
          return { ...item, [field]: value, exchangeRate }
        }

        if (
          field === "quantity" ||
          field === "price" ||
          field === "exchangeRate" ||
          field === "discountValue" ||
          field === "taxRate"
        ) {
          return { ...item, [field]: Number(value) || 0 }
        }

        return { ...item, [field]: value }
      }
      return item
    })
    setInvoiceData({ ...invoiceData, items: updatedItems })
  }

  const addItem = () => {
    setInvoiceData({
      ...invoiceData,
      items: [
        ...invoiceData.items,
        {
          id: uuidv4(),
          description: "",
          quantity: 1,
          price: 0,
          currency: invoiceData.currency,
          exchangeRate: 1,
          discountType: "percentage",
          discountValue: 0,
          taxRate: 18,
        },
      ],
    })
  }

  const removeItem = (id: string) => {
    if (invoiceData.items.length > 1) {
      setInvoiceData({
        ...invoiceData,
        items: invoiceData.items.filter((item) => item.id !== id),
      })
    }
  }

  const calculateItemDiscount = (item: (typeof invoiceData.items)[0]) => {
    const itemSubtotal = item.quantity * item.price
    if (item.discountValue <= 0) return 0

    if (item.discountType === "percentage") {
      return itemSubtotal * (item.discountValue / 100)
    } else {
      return Math.min(item.discountValue, itemSubtotal) // Ensure discount doesn't exceed item subtotal
    }
  }

  const calculateItemTax = (item: (typeof invoiceData.items)[0]) => {
    const itemSubtotal = item.quantity * item.price
    const itemDiscount = calculateItemDiscount(item)
    const taxableAmount = itemSubtotal - itemDiscount
    return taxableAmount * (item.taxRate / 100)
  }

  const calculateItemTotal = (item: (typeof invoiceData.items)[0]) => {
    const itemSubtotal = item.quantity * item.price
    const itemDiscount = calculateItemDiscount(item)
    const itemTax = calculateItemTax(item)
    const itemNetTotal = itemSubtotal - itemDiscount + itemTax

    return item.currency === invoiceData.currency ? itemNetTotal : itemNetTotal * item.exchangeRate
  }

  const calculateSubtotal = () => {
    return invoiceData.items.reduce((sum, item) => {
      const itemSubtotal = item.quantity * item.price
      const itemDiscount = calculateItemDiscount(item)
      const netAmount = itemSubtotal - itemDiscount
      return sum + (item.currency === invoiceData.currency ? netAmount : netAmount * item.exchangeRate)
    }, 0)
  }

  const calculateTotalItemDiscounts = () => {
    return invoiceData.items.reduce((sum, item) => {
      const itemDiscount = calculateItemDiscount(item)
      // Convert to invoice currency if needed
      return sum + (item.currency === invoiceData.currency ? itemDiscount : itemDiscount * item.exchangeRate)
    }, 0)
  }

  const calculateDiscount = () => {
    if (invoiceData.discountValue <= 0) return 0

    let discountableAmount = 0

    if (invoiceData.applyInvoiceDiscountToDiscountedItems) {
      // Apply discount to all items
      discountableAmount = calculateSubtotal()
    } else {
      // Apply discount only to items without their own discount
      discountableAmount = invoiceData.items.reduce((sum, item) => {
        if (item.discountValue > 0) return sum // Skip items with discount

        const itemTotal = item.quantity * item.price
        return sum + (item.currency === invoiceData.currency ? itemTotal : itemTotal * item.exchangeRate)
      }, 0)
    }

    if (invoiceData.discountType === "percentage") {
      return discountableAmount * (invoiceData.discountValue / 100)
    } else {
      return Math.min(invoiceData.discountValue, discountableAmount) // Ensure discount doesn't exceed subtotal
    }
  }

  const calculateTaxableAmount = () => {
    return calculateSubtotal() - calculateDiscount()
  }

  const calculateTotalTax = () => {
    return invoiceData.items.reduce((sum, item) => {
      const itemTax = calculateItemTax(item)
      return sum + (item.currency === invoiceData.currency ? itemTax : itemTax * item.exchangeRate)
    }, 0)
  }

  const calculateTotal = () => {
    return calculateSubtotal() - calculateDiscount() + calculateTotalTax()
  }

  const calculateTaxSummary = () => {
    const taxRates = [0, 18, 28]
    const summary = taxRates
      .map((rate) => {
        const items = invoiceData.items.filter((item) => item.taxRate === rate)
        if (items.length === 0) return null

        const taxableAmount = items.reduce((sum, item) => {
          const itemSubtotal = item.quantity * item.price
          const itemDiscount = calculateItemDiscount(item)
          const netAmount = itemSubtotal - itemDiscount
          return sum + (item.currency === invoiceData.currency ? netAmount : netAmount * item.exchangeRate)
        }, 0)

        const taxAmount = items.reduce((sum, item) => {
          const itemTax = calculateItemTax(item)
          return sum + (item.currency === invoiceData.currency ? itemTax : itemTax * item.exchangeRate)
        }, 0)

        return {
          rate,
          taxableAmount,
          taxAmount,
        }
      })
      .filter(Boolean)

    return summary
  }

  const downloadPdf = async () => {
    if (invoiceRef.current) {
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
      })

      const imgData = canvas.toDataURL("image/png")
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      })

      const imgWidth = 210
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight)
      pdf.save(`invoice-${invoiceData.invoiceNumber}.pdf`)
    }
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Logo is hardcoded, so we don't allow changes
    alert("Logo is hardcoded and cannot be changed.")
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="edit">Edit Invoice</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="edit">
          <InvoiceForm
            invoiceData={invoiceData}
            handleInvoiceChange={handleInvoiceChange}
            handleItemChange={handleItemChange}
            handleLogoUpload={handleLogoUpload}
            addItem={addItem}
            removeItem={removeItem}
            calculateItemDiscount={calculateItemDiscount}
            calculateItemTax={calculateItemTax}
            calculateItemTotal={calculateItemTotal}
            calculateTotalItemDiscounts={calculateTotalItemDiscounts}
            calculateSubtotal={calculateSubtotal}
            calculateDiscount={calculateDiscount}
            calculateTaxableAmount={calculateTaxableAmount}
            calculateTotalTax={calculateTotalTax}
            calculateTotal={calculateTotal}
            calculateTaxSummary={calculateTaxSummary}
          />
        </TabsContent>

        <TabsContent value="preview">
          <Card className="p-6">
            <div ref={invoiceRef}>
              <InvoicePreview
                invoiceData={invoiceData}
                calculateItemDiscount={calculateItemDiscount}
                calculateItemTax={calculateItemTax}
                calculateItemTotal={calculateItemTotal}
                calculateTotalItemDiscounts={calculateTotalItemDiscounts}
                calculateSubtotal={calculateSubtotal}
                calculateDiscount={calculateDiscount}
                calculateTaxableAmount={calculateTaxableAmount}
                calculateTotalTax={calculateTotalTax}
                calculateTotal={calculateTotal}
                calculateTaxSummary={calculateTaxSummary}
              />
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={downloadPdf}>Download PDF</Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
