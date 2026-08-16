import { Product, Shipment, Carrier } from "../types/models";
import { sampleProducts, sampleCarriers, sampleShipment } from "../types/models";
import { ListOfCountry } from "../types/models";

function calculateShippingCost(shipment: Shipment[], product: Product[], carrier: Carrier[]): number | string {
    let storeProdSku = [];
    let storeShipCarrier = [];
    let total: number | string = 0;
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
                        total = calcTotal;
                    }
                }

            }
        }

    }
    return `>>>> Total shiping cost is :: ${total}`;
}

function scoreCarrierForShipment(carrier: Carrier[], shipment: Shipment[], product: Product[]): number | string {
    let storeProdSku = [];
    let storeShipCarrier = [];  
    let addPoints: number = 0;
    for (let gama = 0; gama < product.length; gama++) {
        storeProdSku.push(product[gama].sku)

        for (let beta = 0; beta < shipment.length; beta++) {
            if (shipment[beta].sku === storeProdSku[gama]) {
                storeShipCarrier.push(shipment[beta].carrier)

                for (let i = 0; i < carrier.length; i++) {
                    if (carrier[i].operatesIn.includes("Spain")) {
                        addPoints += 20;
                        console.log(`${carrier[i].name} Carrrier opearates in Spain`)
                    }
                    if (carrier[i].operatesIn.includes("United States")) {
                        addPoints += 20;
                        console.log(`${carrier[i].name} Carrrier opearates in United States`)
                    }
                    if (product[gama].weightKg * shipment[beta].quantity <= carrier[i].maxWeightKg) {
                        addPoints += 20
                    }
                    if (carrier[i].acceptsPriority.length > 0) {
                        addPoints += 15
                    }
                    if (product[gama].isFragile && carrier[i].handlesFragile) {
                        addPoints += 15
                    }
                    if (product[gama].isFragile === false) {
                        addPoints += 15
                    }
                    if (product[gama].isFragile && carrier[i].handlesFragile === false) {
                        addPoints += 15
                    }
                    if (carrier[i].onTimeRate > 0) {
                        addPoints += carrier[i].onTimeRate * 0.3
                    }
                }
            }
        }
    }

    return `>>> Suitability scroe for the carrier:: ${addPoints.toFixed(2)} `

}



// console.log(calculateShippingCost(sampleShipment, sampleProducts, sampleCarriers))
console.log(scoreCarrierForShipment(sampleCarriers, sampleShipment, sampleProducts))