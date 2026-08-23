import { Product, Shipment, Carrier } from "../types/models";
import { sampleProducts, sampleCarriers, sampleShipment } from "../types/models";

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

function scoreCarrierForShipment(carrier: Carrier[], shipment: Shipment[], product: Product[]): Array<{ carrierName: string, addPoints: number }> {

    let storeProdSku: string[] = [];
    let storeShipCarrier: { carrierName: string, addPoints: number }[] = [];

    for (let gama = 0; gama < product.length; gama++) {
        storeProdSku.push(product[gama].sku)

        for (let beta = 0; beta < shipment.length; beta++) {
            if (shipment[beta].sku === storeProdSku[gama]) {
                const matchedCarrier = carrier.find(c => c.id === shipment[beta].carrier);

                if (matchedCarrier) {
                    let existingCarrier = storeShipCarrier.find(c => c.carrierName === matchedCarrier.id);

                    if (!existingCarrier) {
                        existingCarrier = { carrierName: matchedCarrier.id, addPoints: 0 };
                        storeShipCarrier.push(existingCarrier);
                    }

                    calculateCarrierScore(existingCarrier, matchedCarrier, shipment[beta], product[gama]);
                }
            }
        }
    }

    return storeShipCarrier;

    function calculateCarrierScore(existingCarrier: { carrierName: string, addPoints: number }, matchedCarrier: Carrier, currentShipment: Shipment, currentProduct: Product) {
        if (matchedCarrier.operatesIn.includes("Spain")) {
            existingCarrier.addPoints += 20;
        }
        if (matchedCarrier.operatesIn.includes("United States")) {
            existingCarrier.addPoints += 20;
        }
        if (currentProduct.weightKg * currentShipment.quantity <= matchedCarrier.maxWeightKg) {
            existingCarrier.addPoints += 20
        }
        if (matchedCarrier.acceptsPriority.length > 0) {
            existingCarrier.addPoints += 15
        }
        if (currentProduct.isFragile && matchedCarrier.handlesFragile) {
            existingCarrier.addPoints += 15
        }
        if (currentProduct.isFragile === false) {
            existingCarrier.addPoints += 15
        }
        if (currentProduct.isFragile && matchedCarrier.handlesFragile === false) {
            existingCarrier.addPoints += 15
        }
        if (matchedCarrier.onTimeRate > 0) {
            existingCarrier.addPoints += matchedCarrier.onTimeRate * 0.3
        }
    }
}


function selectBestCarrier(carriers: Carrier[], shipment: Shipment[], product: Product[]): { carrier: Carrier, score: number, cost: number } | null {
    const carrierScores = scoreCarrierForShipment(carriers, shipment, product);
    let bestCarrier: { carrier: Carrier, score: number, cost: number } | null = null;
    const carrierCostOptions: Array<{ carrier: Carrier, score: number, cost: number }> = [];

    for (const carrierScore of carrierScores) {
        if (carrierScore.addPoints < 200) {
            const matchedCarrier = carriers.find(c => c.id === carrierScore.carrierName);
            if (!matchedCarrier) {
                continue;
            }

            const calculateCost = calculateShippingCost(shipment, product, [matchedCarrier]);
            const numericCost = typeof calculateCost === "number"
                ? calculateCost
                : Number(calculateCost.match(/(\d+(?:\.\d+)?)$/)?.[1]);

            if (!Number.isFinite(numericCost)) {
                continue;
            }

            carrierCostOptions.push({
                carrier: matchedCarrier,
                score: carrierScore.addPoints,
                cost: numericCost,
            });
        }
    }

    if (carrierCostOptions.length === 0) {
        return null;
    }

    bestCarrier = carrierCostOptions[0];
    for (let i = 1; i < carrierCostOptions.length; i++) {
        if (carrierCostOptions[i].cost < bestCarrier.cost) {
            bestCarrier = carrierCostOptions[i];
        }
    }

    return bestCarrier;
}


function countProductsByCategory(products: Product[]) {
    // let count = 0 
    // let categoryCheck = ""
    const categoryCount = [{ category: "", count: 0 }]
    for (let cnt = 0; cnt < products.length; cnt++) {
        if (products[cnt].category) {
            const existingCategory = categoryCount.find(c => c.category === products[cnt].category);
            if (existingCategory) {
                existingCategory.count += 1;
            } else {
                categoryCount.push({ category: products[cnt].category, count: 1 });
            }
            // categoryCheck = products[cnt].category
        }
    }
    return categoryCount
}

function calculateTotalInventoryValue(products: Product[]): number {
    let totalValue = 0;
    for (let i = 0; i < products.length; i++) {
        totalValue += products[i].stockQuantity * products[i].unitCostUSD;
    }
    return `Total Inventory value is ${totalValue.toFixed(2)}` as unknown as number;
}

function calculateAverageShipmentDistance(shipments: Shipment[]): number {
    let totalDistance = 0;
    for (let i = 0; i < shipments.length; i++) {
        totalDistance += shipments[i].destination.distanceKm;
    }
    return `Average shipment distance is ${shipments.length > 0 ? totalDistance / shipments.length : 0}` as unknown as number;
}

function groupShipmentsByStatus(shipments: Shipment[]): Record<string, Shipment[]> {
    const groupedShipments: Record<string, Shipment[]> = {};

    for (const shipment of shipments) {
        console.log(shipment.status)
        if (!groupedShipments[shipment.status]) {
            groupedShipments[shipment.status] = [];
            console.log(groupedShipments[shipment.status])
        }
        groupedShipments[shipment.status].push(shipment);
    }

    return groupedShipments;
}

function findTopCarriers(shipments: Shipment[], topN: number): Array<{ carrier: string, count: number }> {
    const carrierCount: Array<{ carrier: string, count: number }> = []
    // const carrierCounts: Array<{carrier: string, count: number}> = []
    for (let i = 0; i < shipments.length; i++) {
        if (shipments[i].carrier) {
            const existingCarrier = carrierCount.find(c => c.carrier === shipments[i].carrier)
            if (existingCarrier) {
                existingCarrier.count += 1
            } else {
                carrierCount.push({ carrier: shipments[i].carrier, count: 1 })
            }
        }
    }
    return carrierCount.sort((a, b) => b.count - a.count).slice(0, topN);
}



console.log(calculateShippingCost(sampleShipment, sampleProducts, sampleCarriers))
console.log(scoreCarrierForShipment(sampleCarriers, sampleShipment, sampleProducts))
console.log(selectBestCarrier(sampleCarriers, sampleShipment, sampleProducts))
console.log(countProductsByCategory(sampleProducts))
console.log(calculateTotalInventoryValue(sampleProducts))
console.log(calculateAverageShipmentDistance(sampleShipment))
console.log(groupShipmentsByStatus(sampleShipment))
console.log(findTopCarriers(sampleShipment, 3))





