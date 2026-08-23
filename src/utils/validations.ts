import { Product, Shipment, Carrier } from "../types/models";
import { sampleCarriers, sampleProducts, sampleShipment } from "../types/models";

function validateProduct(product: Product[]): { valid: boolean, errors: string[] } {

  // const message:{ valid: boolean, errors: string[] } = 

  for (let i = 0; i < sampleProducts.length; i++) {

    //sku must not be empty
    if (sampleProducts[i].sku == "") {
      return { valid: false, errors: ["sku must not be empty"] }
    }

    //weightKg must be > 0 and <= 100
    if ((sampleProducts[i].weightKg < 0) || (sampleProducts[i].weightKg > 100)) {
      return { valid: false, errors: ["weightKg value must be inbetween 0 and 100"] }
    }

    //All dimensions must be > 0 and <= 200
    if (sampleProducts[i].dimensions.heightCm < 0 || sampleProducts[i].dimensions.heightCm > 200) {
      return { valid: false, errors: ["Dimension heightCm value must be inbetween 0 and 200"] }
    }
    if (sampleProducts[i].dimensions.lengthCm < 0 || sampleProducts[i].dimensions.lengthCm > 200) {
      return { valid: false, errors: ["Dimension lengthCm value must be inbetween 0 and 200"] }
    }
    if (sampleProducts[i].dimensions.widthCm < 0 || sampleProducts[i].dimensions.widthCm > 200) {
      return { valid: false, errors: ["Dimension widthCm value must be inbetween 0 and 200"] }
    }
    //stockQuantity must be >= 0
    if (sampleProducts[i].stockQuantity < 0) {
      return { valid: false, errors: ["stockQuantity must be greater than are equal to zero"] }
    }
    //minStockThreshold must be >= 0
    if (sampleProducts[i].minStockThreshold < 0) {
      return { valid: false, errors: ["minStockThreshold must be greater than are equal to zero"] }
    }
    //unitCostUSD must be > 0
    if (sampleProducts[i].unitCostUSD < 0) {
      return { valid: false, errors: ["unitCostUSD must be greater than zero"] }
    }

  }
  return { valid: true, errors: [] };
}


function validateShipment(shipment: Shipment[]): { valid: boolean, errors: string[] } {
  for (let j = 0; j < shipment.length; j++) {
    if (shipment[j].quantity < 0) {
      return { valid: false, errors: ["quantity must be greater than 0"] }
    }
    if (shipment[j].declaredValueUSD < 0) {
      return { valid: false, errors: ["declaredValueUSD must be greater than 0"] }
    }
    if (shipment[j].destination.distanceKm <= 0) {
      return { valid: false, errors: ["distanceKm must be greater than or equal to 0"] }
    }
  }
  return { valid: true, errors: [] }
}
function validateCarrier(carrier: Carrier[]): { valid: boolean, errors: string[] } {
  for (let k = 0; k < carrier.length; k++) {
    if (carrier[k].baseRateUSD <= 0 && carrier[k].ratePerKgUSD <= 0 && carrier[k].ratePerKmUSD <= 0) {
      return { valid: false, errors: ["Value of baseRateUSD, ratePerKgUSD, ratePerKmUSD must be greater than or equal to 0 "] }
    }
    if (carrier[k].avgDeliveryDays < 0) {
      return { valid: false, errors: ["avgDeliveryDays must be grtearer than or equal to 0"] }
    }
    if (carrier[k].onTimeRate < 0 || carrier[k].onTimeRate > 100) {
      return { valid: false, errors: ["OnTimeRate must be inbetween 0 and 100"] }
    }
    if (carrier[k].maxWeightKg < 0) {
      return { valid: false, errors: ["maxWeightKg must be greater than 0"] }
    }
    if (carrier[k].operatesIn.length === 0){
      return { valid: false, errors: ["operatesIn must operate in at least one country"] }
    }
}
return { valid: true, errors: [] }
}

// Validation rules for Product
console.log(validateProduct(sampleProducts))
// Validation rules for Shipment
console.log(validateShipment(sampleShipment))
// Validation rules for Carrier
console.log(validateCarrier(sampleCarriers))



