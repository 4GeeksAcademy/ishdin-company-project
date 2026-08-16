import { Product, Shipment, Carrier } from "../types/models";
import { sampleProducts, sampleCarriers, sampleShipment } from "../types/models";

function calculateShippingCost(shipment: Shipment[], product: Product[], carrier: Carrier[]): number | string {
    let storeProdSku = [];
    let storeShipCarrier = [];
    let total: number = 0;
    for (let prod = 0; prod < product.length; prod++) {
        storeProdSku.push(product[prod].sku)
        for (let ship = 0; ship < shipment.length; ship++) {
            if (shipment[ship].sku === storeProdSku[prod]) {
                storeShipCarrier.push(shipment[ship].carrier)
                for (let care = 0; care < carrier.length; care++) {
                    if (storeShipCarrier[ship] === carrier[care].id) {
                        let calcBaseRate = carrier[care].baseRateUSD
                        let weightCost = product[prod].weightKg * carrier[care].ratePerKgUSD * shipment[ship].quantity
                        let distanceCost = shipment[ship].destination.distanceKm * carrier[care].ratePerKmUSD
                        let subTotal = calcBaseRate + weightCost + distanceCost
                        let surChargeFactor: number = 1
                        if (shipment[ship].priority == 'Express') {
                            surChargeFactor = 1.3;
                        }
                        if (shipment[ship].priority == 'Same-day') {
                            surChargeFactor = 1.6;
                        }
                        const calcTotal = (subTotal * surChargeFactor).toFixed(2)
                        total = Number(calcTotal);
                    }
                }

            }
        }

    }
    return `>>>> Total shiping cost is :: ${total}`;
}

function scoreCarrierForShipment(carrier: Carrier[], shipment: Shipment[], product: Product[]): number{
    for(let )
}



// console.log(calculateShippingCost(sampleShipment, sampleProducts, sampleCarriers))
console.log(scoreCarrierForShipment(sampleCarriers,sampleShipment,sampleProducts))