const DEFAULT_WIDTH_MM = 1850;
const DEFAULT_LENGTH_MM = 4800;
const DEFAULT_MASS = 2000;
const MEDIAN_HEIGHT_MM = 1500;
const OUTLIER_WIDTH_M = 3.4;

let mathTypeset = false;
let widthOverrideM = null;
let isHeightMissing = false;

function setControlsDisabled(disabled) {
    document.getElementById('width').disabled = disabled;
}

function resetToDefaults() {
    window.currentMass = DEFAULT_MASS;
    widthOverrideM = null;
    delete window.customBaseCd;

    document.getElementById('width').value = DEFAULT_WIDTH_MM;
    setControlsDisabled(false);
    document.getElementById('iqr-alert').style.display = 'none';

    isHeightMissing = false;
    document.getElementById('height').disabled = false;
    document.getElementById('missing-alert').style.display = 'none';
}

function setVehiclePreset(targetHeight, targetCd, targetMass) {
    document.getElementById('height').value = targetHeight;
    window.customBaseCd = targetCd;
    window.currentMass = targetMass || DEFAULT_MASS;

    widthOverrideM = null;
    document.getElementById('width').value = DEFAULT_WIDTH_MM;
    setControlsDisabled(false);
    document.getElementById('iqr-alert').style.display = 'none';

    isHeightMissing = false;
    document.getElementById('height').disabled = false;
    document.getElementById('missing-alert').style.display = 'none';

    updateSimulator();
}

function loadSampleData(isOutlier) {
    if (isOutlier) {
        document.getElementById('height').value = 1500;
        widthOverrideM = OUTLIER_WIDTH_M;
        setControlsDisabled(true);

        const q1 = 1.80, q3 = 1.95;
        const iqr = q3 - q1;
        const maxBoundary = q3 + (1.5 * iqr);

        if (widthOverrideM > maxBoundary) {
            const alertBox = document.getElementById('iqr-alert');
            alertBox.style.display = 'block';
            alertBox.innerText = `⚠️ [이상치 감지] 전폭 수치(${widthOverrideM}m)가 IQR 임계값(${maxBoundary}m)을 초과하여 정제 필터링이 필요합니다! (슬라이더가 잠금 처리됩니다)`;
        }
    } else {
        document.getElementById('height').value = 1450;
        resetToDefaults();
    }
    updateSimulator();
}

function simulateMissingHeight() {
    isHeightMissing = true;
    document.getElementById('height').disabled = true;

    const alertBox = document.getElementById('missing-alert');
    alertBox.style.display = 'block';
    alertBox.innerText = `🛠️ [결측치 발생] 전고(height) 센서 값이 누락되었습니다. 데이터셋 중앙값(Median)인 ${MEDIAN_HEIGHT_MM}mm로 대체됩니다.`;

    updateSimulator();
}

function restoreMissingHeight() {
    isHeightMissing = false;
    document.getElementById('height').disabled = false;
    document.getElementById('missing-alert').style.display = 'none';
    updateSimulator();
}

function updateSimulator() {
    const speed = parseFloat(document.getElementById('speed').value);
    const heightSliderMM = parseFloat(document.getElementById('height').value);
    const effectiveHeightMM = isHeightMissing ? MEDIAN_HEIGHT_MM : heightSliderMM;
    const height = effectiveHeightMM / 1000;

    const widthSliderM = parseFloat(document.getElementById('width').value) / 1000;
    const width = widthOverrideM !== null ? widthOverrideM : widthSliderM;

    const lengthMM = parseFloat(document.getElementById('length').value);

    const mass = window.currentMass || DEFAULT_MASS;

    document.getElementById('speed-val').innerText = speed;
    document.getElementById('height-val').innerText = effectiveHeightMM.toFixed(0);
    document.getElementById('width-val').innerText = (width * 1000).toFixed(0);
    document.getElementById('length-val').innerText = lengthMM.toFixed(0);

    let base_cd = window.customBaseCd || 0.24;
    let effective_cd = base_cd;
    let controlMode = "BALANCED";
    let flapState = "닫힘";
    let spoilerAngle = 0;

    if (speed < 60) {
        controlMode = "COOLING";
        flapState = "열림 (냉각 효율 우선)";
        effective_cd = base_cd + 0.03;
    } else if (speed >= 100) {
        controlMode = "ECO-AERO";
        flapState = "닫힘 (항력 최소화)";
        spoilerAngle = 12;
        effective_cd = base_cd - 0.02;
    } else {
        controlMode = "BALANCED";
        flapState = "닫힘";
        spoilerAngle = 0;
    }

    const rho = 1.225;
    const v = speed * (1000 / 3600);
    const A = height * width;
    const dragForce = 0.5 * rho * Math.pow(v, 2) * effective_cd * A;

    const g = 9.81;
    const cr = 0.01;
    const rollingResistance = mass * g * cr;

    const totalResistance = dragForce + rollingResistance;
    const fdRatio = (dragForce / totalResistance) * 100;
    const frRatio = (rollingResistance / totalResistance) * 100;

    let base_efficiency = 7.5;
    let efficiency_loss = (dragForce * 0.005) + (speed * 0.01);
    let final_efficiency = Math.max(2.0, base_efficiency - efficiency_loss);

    document.getElementById('control-mode').innerText = controlMode;
    document.getElementById('flap-state').innerText = flapState;
    document.getElementById('spoiler-state').innerText = spoilerAngle;
    document.getElementById('efficiency').innerText = final_efficiency.toFixed(2);

    const efficiencyPercent = (final_efficiency / 8.0) * 100;
    const effBar = document.getElementById('efficiency-bar');
    effBar.style.width = `${Math.min(100, efficiencyPercent)}%`;

    if (final_efficiency >= 5.5) {
        effBar.style.backgroundColor = '#28a745';
    } else if (final_efficiency >= 4.0) {
        effBar.style.backgroundColor = '#ffc107';
    } else {
        effBar.style.backgroundColor = '#dc3545';
    }

    document.getElementById('param-h').innerText = height.toFixed(3);
    document.getElementById('param-w').innerText = width.toFixed(2);
    document.getElementById('calc-A').innerText = A.toFixed(3);

    document.getElementById('param-v').innerText = v.toFixed(1);
    document.getElementById('param-cd').innerText = effective_cd.toFixed(3);
    document.getElementById('param-area').innerText = A.toFixed(3);
    document.getElementById('calc-fd').innerText = dragForce.toFixed(1);

    document.getElementById('dict-v-km').innerText = speed;
    document.getElementById('dict-v-m').innerText = v.toFixed(1);
    document.getElementById('dict-cd').innerText = effective_cd.toFixed(3);

    document.getElementById('ratio-fd-val').innerText = dragForce.toFixed(0);
    document.getElementById('ratio-fr-val').innerText = rollingResistance.toFixed(0);
    document.getElementById('ratio-fd-pct').innerText = fdRatio.toFixed(0);
    document.getElementById('ratio-fr-pct').innerText = frRatio.toFixed(0);
    document.getElementById('bar-fd').style.width = `${fdRatio}%`;
    document.getElementById('bar-fr').style.width = `${frRatio}%`;

    if (!mathTypeset && window.MathJax && window.MathJax.typeset) {
        window.MathJax.typeset();
        mathTypeset = true;
    }
}

resetToDefaults();
updateSimulator();

if (window.MathJax) {
    const mjScript = document.getElementById('MathJax-script');
    mjScript.addEventListener('load', () => {
        if (!mathTypeset && window.MathJax.typeset) {
            window.MathJax.typeset();
            mathTypeset = true;
        }
    });
}