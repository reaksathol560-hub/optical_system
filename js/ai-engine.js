/**
 * =============================================================================
 * AI OPTICAL LENS & INDEX RECOMMENDATION ENGINE
 * =============================================================================
 * Local rule-based intelligent engine evaluating prescription parameters
 * (Sphere, Cylinder, Axis, Addition) and mapping them to optimal branch stock items.
 */

const AiEngine = {

    /**
     * Analyze optical refraction prescription values and form clinical recommendations
     */
    analyzePrescription(prescription) {
        if (!prescription) {
            return {
                isHighMyopia: false,
                isHighAstigmatism: false,
                isPresbyopia: false,
                rationaleSummary: 'Standard visual correction required.'
            };
        }

        const maxSph = Math.max(Math.abs(prescription.od_sph || 0), Math.abs(prescription.os_sph || 0));
        const maxCyl = Math.max(Math.abs(prescription.od_cyl || 0), Math.abs(prescription.os_cyl || 0));
        const maxAdd = Math.max(prescription.od_add || 0, prescription.os_add || 0);

        const isHighMyopia = maxSph >= 4.00;
        const isModerateMyopia = maxSph >= 2.00 && maxSph < 4.00;
        const isHighAstigmatism = maxCyl >= 1.50;
        const isPresbyopia = maxAdd > 0.00;

        const summaryParts = [];

        if (isHighMyopia) {
            summaryParts.push(`High Myopia/Power (|SPH| = ${maxSph.toFixed(2)}D): High index (1.67 or 1.74) required for thin edge profile & light weight.`);
        } else if (isModerateMyopia) {
            summaryParts.push(`Moderate Power (|SPH| = ${maxSph.toFixed(2)}D): 1.56 or 1.60 index recommended.`);
        }

        if (isHighAstigmatism) {
            summaryParts.push(`Astigmatism (|CYL| = ${maxCyl.toFixed(2)}D): Aspheric anti-distortion design suggested.`);
        }

        if (isPresbyopia) {
            summaryParts.push(`Presbyopia (ADD +${maxAdd.toFixed(2)}D): Premium Progressive lens recommended for seamless distance-to-near vision.`);
        }

        if (summaryParts.length === 0) {
            summaryParts.push('Standard Single Vision lens with Anti-Reflective & Blue Light protection recommended.');
        }

        return {
            maxSph,
            maxCyl,
            maxAdd,
            isHighMyopia,
            isModerateMyopia,
            isHighAstigmatism,
            isPresbyopia,
            rationaleSummary: summaryParts.join(' ')
        };
    },

    /**
     * Filter and rank available branch products based on prescription analysis
     */
    getRecommendations(prescription, branchProducts = []) {
        if (!prescription || !branchProducts.length) return [];

        const analysis = this.analyzePrescription(prescription);
        const recommendations = [];

        branchProducts.forEach(product => {
            if (product.category !== 'Lenses' || product.stock <= 0) return;

            const nameLower = product.name.toLowerCase();
            const descLower = (product.description || '').toLowerCase();
            const rxTypeLower = (product.prescription_type || '').toLowerCase();

            let matched = false;
            let reason = '';

            // Rule 1: High Index for High Myopia
            if (analysis.isHighMyopia && (nameLower.includes('1.67') || nameLower.includes('1.74') || nameLower.includes('ultra high'))) {
                matched = true;
                reason = `High Index (${nameLower.includes('1.74') ? '1.74' : '1.67'}) minimizes edge thickness for SPH ${analysis.maxSph.toFixed(2)}D.`;
            }
            // Rule 2: Progressive Lens for Presbyopia
            else if (analysis.isPresbyopia && (nameLower.includes('progressive') || rxTypeLower.includes('progressive'))) {
                matched = true;
                reason = `Progressive multi-focal design provides continuous clarity for ADD +${analysis.maxAdd.toFixed(2)}D.`;
            }
            // Rule 3: Photochromic for Outdoor comfort
            else if (nameLower.includes('transitions') || nameLower.includes('photochromic') || rxTypeLower.includes('photochromic')) {
                matched = true;
                reason = 'Adaptive outdoor tinting provides UV protection & light glare comfort.';
            }
            // Rule 4: Polycarbonate for Impact Safety & Moderate Prescriptions
            else if (nameLower.includes('polycarbonate') || nameLower.includes('poly')) {
                matched = true;
                reason = 'Impact resistant shatterproof material ideal for active lifestyle.';
            }
            // Rule 5: Standard Single Vision Anti-Blue
            else if (nameLower.includes('anti-blue') || nameLower.includes('1.56') || rxTypeLower.includes('single vision')) {
                matched = true;
                reason = 'Anti-blue light filter shields eyes during heavy computer screen usage.';
            }

            if (matched) {
                recommendations.push({
                    product,
                    reason
                });
            }
        });

        return recommendations;
    }
};

window.AiEngine = AiEngine;
