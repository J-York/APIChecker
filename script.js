// --- DOM Element References ---
const baseUrlInput = document.getElementById('baseUrl');
const apiKeyInput = document.getElementById('apiKey');
const providerNameInput = document.getElementById('providerName');
const fetchModelsBtn = document.getElementById('fetchModelsBtn');
const saveProviderBtn = document.getElementById('saveProviderBtn');
const modelSelect = document.getElementById('modelSelect');
const customModelInput = document.getElementById('customModel');
const testModelBtn = document.getElementById('testModelBtn');
const resultArea = document.getElementById('resultArea');
const loaderModels = document.getElementById('loaderModels');
const loaderTest = document.getElementById('loaderTest');
const savedProvidersContainer = document.getElementById('savedProviders');
const enableStreamingCheckbox = document.getElementById('enableStreaming');
const singleModelSection = document.getElementById('singleModelSection');
const multiModelSection = document.getElementById('multiModelSection');
const toggleModelsBtn = document.getElementById('toggleModelsBtn');
const toggleModelsBackBtn = document.getElementById('toggleModelsBackBtn');
const modelsContainer = document.getElementById('modelsContainer');
const selectAllBtn = document.getElementById('selectAllBtn');
const deselectAllBtn = document.getElementById('deselectAllBtn');
const batchTestBtn = document.getElementById('batchTestBtn');
const loaderBatchTest = document.getElementById('loaderBatchTest');
const testResultsContainer = document.getElementById('testResultsContainer');
const testResultsTable = document.getElementById('testResultsTable');
const testResultsBody = document.getElementById('testResultsBody');
const exportProvidersBtn = document.getElementById('exportProvidersBtn');
const importProvidersBtn = document.getElementById('importProvidersBtn');
const importProvidersFile = document.getElementById('importProvidersFile');
const threadCountInput = document.getElementById('threadCount');
const testPromptInput = document.getElementById('testPrompt');
const timeoutInput = document.getElementById('timeoutInput');

function fetchWithTimeout(resource, options = {}, timeout = 10000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    options.signal = controller.signal;
    return fetch(resource, options)
        .finally(() => clearTimeout(id));
}

// --- State Management & LocalStorage ---

function saveStreamingPreference() {
    localStorage.setItem('enableStreaming', enableStreamingCheckbox.checked);
}

function loadStreamingPreference() {
    const savedPreference = localStorage.getItem('enableStreaming');
    if (savedPreference !== null) {
        enableStreamingCheckbox.checked = savedPreference === 'true';
    }
}

function loadSavedData() {
    baseUrlInput.value = localStorage.getItem('currentBaseUrl') || '';
    apiKeyInput.value = localStorage.getItem('currentApiKey') || '';
    customModelInput.value = localStorage.getItem('currentCustomModel') || '';
    providerNameInput.value = localStorage.getItem('currentProviderName') || '';
    loadStreamingPreference();
    loadSavedProviders();
    updateTestButtonState(); // Initial state update
}

function saveCurrentData() {
    localStorage.setItem('currentBaseUrl', baseUrlInput.value);
    localStorage.setItem('currentApiKey', apiKeyInput.value);
    localStorage.setItem('currentCustomModel', customModelInput.value);
    localStorage.setItem('currentProviderName', providerNameInput.value);
}

function saveProvider() {
    const baseUrl = baseUrlInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    const providerName = providerNameInput.value.trim() || "未命名 Provider"; // Default name
    const customModel = customModelInput.value.trim();
    const selectedModel = modelSelect.value;
    const useStreaming = enableStreamingCheckbox.checked;

    if (!baseUrl || !apiKey) {
        logResult("错误: 保存前请输入 Base URL 和 API Key。", 'error');
        return;
    }

    const providers = JSON.parse(localStorage.getItem('savedProviders') || '[]');
    const existingIndex = providers.findIndex(p => p.name === providerName);

    const providerData = {
        name: providerName,
        baseUrl: baseUrl,
        apiKey: apiKey,
        customModel: customModel,
        selectedModel: selectedModel,
        useStreaming: useStreaming,
        timestamp: new Date().toISOString()
    };

    if (existingIndex >= 0) {
        providers[existingIndex] = providerData;
        logResult(`已更新 Provider: ${providerName}`, 'success');
    } else {
        providers.push(providerData);
        logResult(`已保存新 Provider: ${providerName}`, 'success');
    }

    localStorage.setItem('savedProviders', JSON.stringify(providers));
    loadSavedProviders();
}

function loadSavedProviders() {
    const providers = JSON.parse(localStorage.getItem('savedProviders') || '[]');

    if (providers.length === 0) {
        savedProvidersContainer.innerHTML = '<div class="no-providers">尚未保存任何 Provider。请使用上方的“保存 Provider”按钮保存当前配置。</div>';
        return;
    }

    providers.sort((a, b) => a.name.localeCompare(b.name));
    savedProvidersContainer.innerHTML = '';

    providers.forEach(provider => {
        const card = document.createElement('div');
        card.className = 'provider-card';
        const date = new Date(provider.timestamp);
        const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); // Shorter time format
        let modelInfo = '未指定模型';
        if (provider.selectedModel && provider.selectedModel !== "-- 请先获取模型列表 --" && provider.selectedModel !== "-- Select a model --") { // Check for valid selection
                modelInfo = `已选模型: ${provider.selectedModel}`;
        } else if (provider.customModel) {
                modelInfo = `自定义模型: ${provider.customModel}`;
        }
        const streamingInfo = provider.useStreaming !== undefined ?
            `<p><strong>流式:</strong> ${provider.useStreaming ? '启用' : '禁用'}</p>` : '';
        const maskedKey = provider.apiKey.length > 8 ?
                provider.apiKey.substring(0, 4) + '...' + provider.apiKey.substring(provider.apiKey.length - 4) :
                provider.apiKey; // Avoid masking very short keys completely

        card.innerHTML = `
            <h4>${escapeHtml(provider.name)}</h4>
            <p><strong>URL:</strong> ${escapeHtml(provider.baseUrl)}</p>
            <p><strong>API Key:</strong> <span title="${escapeHtml(provider.apiKey)}">${escapeHtml(maskedKey)}</span></p> ${streamingInfo}
            <p class="model-info">${escapeHtml(modelInfo)}</p>
            <p><small>保存于: ${formattedDate}</small></p>
            <div class="provider-actions">
                <button class="btn-info use-provider btn-sm" data-provider="${escapeHtml(provider.name)}">使用</button>
                <button class="btn-danger delete-provider btn-sm" data-provider="${escapeHtml(provider.name)}">删除</button>
            </div>
        `;
        savedProvidersContainer.appendChild(card);
    });

    // Re-attach event listeners
    document.querySelectorAll('.use-provider').forEach(button => button.addEventListener('click', useProvider));
    document.querySelectorAll('.delete-provider').forEach(button => button.addEventListener('click', deleteProvider));
}

function useProvider(event) {
    const providerName = event.target.getAttribute('data-provider');
    const providers = JSON.parse(localStorage.getItem('savedProviders') || '[]');
    const provider = providers.find(p => p.name === providerName);

    if (provider) {
        baseUrlInput.value = provider.baseUrl;
        apiKeyInput.value = provider.apiKey;
        providerNameInput.value = provider.name;
        customModelInput.value = provider.customModel || '';

        if (provider.useStreaming !== undefined) {
            enableStreamingCheckbox.checked = provider.useStreaming;
            saveStreamingPreference();
        }

        // Reset and potentially populate model select
        modelSelect.innerHTML = '<option value="">-- 请先获取模型列表 --</option>';
        if (provider.selectedModel && provider.selectedModel !== "-- 请先获取模型列表 --" && provider.selectedModel !== "-- Select a model --") {
            const option = document.createElement('option');
            option.value = provider.selectedModel;
            option.textContent = provider.selectedModel;
            option.selected = true;
            modelSelect.appendChild(option);
        }

        // Clear multi-model state
        modelsContainer.innerHTML = '<div class="no-models">请先获取模型列表。</div>';
        testResultsContainer.style.display = 'none';
        testResultsBody.innerHTML = ''; // Clear previous results

        saveCurrentData();
        updateTestButtonState();
        logResult(`已加载 Provider: ${providerName}`, 'success');
            // Scroll to top after loading provider
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function deleteProvider(event) {
    const providerName = event.target.getAttribute('data-provider');
    if (confirm(`确定要删除 Provider "${providerName}" 吗?`)) {
        let providers = JSON.parse(localStorage.getItem('savedProviders') || '[]');
        providers = providers.filter(p => p.name !== providerName);
        localStorage.setItem('savedProviders', JSON.stringify(providers));
        loadSavedProviders();
        logResult(`已删除 Provider: ${providerName}`, 'info');
    }
}

function exportProviders() {
    const providers = JSON.parse(localStorage.getItem('savedProviders') || '[]');
    if (providers.length === 0) {
        logResult("没有可导出的 Provider。", 'info');
        return;
    }
    const dataStr = JSON.stringify(providers, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'llm_tester_providers.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    logResult(`已导出 ${providers.length} 个 Provider 到 llm_tester_providers.json`, 'success');
}

function importProviders(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (!Array.isArray(importedData)) throw new Error("无效的文件格式，需要 JSON 数组。");

            const isValid = importedData.every(p => p.name && p.baseUrl && p.apiKey);
            if (!isValid) throw new Error("文件中的数据结构无效。");

            let existingProviders = JSON.parse(localStorage.getItem('savedProviders') || '[]');
            const importedProvidersMap = new Map(importedData.map(p => [p.name, p]));

                // Merge: Update existing by name, add new ones
                let updated = false;
            existingProviders = existingProviders.map(provider => {
                if (importedProvidersMap.has(provider.name)) {
                    updated = true;
                    return importedProvidersMap.get(provider.name); // Replace with imported
                }
                return provider;
                });

                importedData.forEach(importedProvider => {
                    if (!existingProviders.some(p => p.name === importedProvider.name)) {
                        existingProviders.push(importedProvider); // Add new
                        updated = true;
                    }
                });

            if (updated) {
                localStorage.setItem('savedProviders', JSON.stringify(existingProviders));
                loadSavedProviders();
                logResult(`成功导入并合并了 ${importedData.length} 个 Provider 配置。`, 'success');
            } else {
                    logResult('导入的文件未包含新的或需要更新的 Provider。', 'info');
            }

        } catch (error) {
            console.error("导入错误:", error);
            logResult(`导入 Provider 失败: ${error.message}`, 'error');
        } finally {
            importProvidersFile.value = ''; // Reset file input
        }
    };
    reader.onerror = () => {
        logResult("读取文件时出错。", 'error');
        importProvidersFile.value = '';
    };
    reader.readAsText(file);
}

// --- UI Interaction & Updates ---

function showLoader(loaderElement, show) {
    loaderElement.style.display = show ? 'inline-block' : 'none';
}

function updateTestButtonState() {
    const modelSelected = modelSelect.value && modelSelect.value !== "-- 请先获取模型列表 --" && modelSelect.value !== "-- Select a model --";
    const customModelEntered = customModelInput.value.trim() !== "";
    const apiReady = baseUrlInput.value.trim() !== "" && apiKeyInput.value.trim() !== "";

    testModelBtn.disabled = !(apiReady && (modelSelected || customModelEntered));
}

function updateBatchTestButton() {
    const anyChecked = Array.from(document.querySelectorAll('#modelsContainer input[type="checkbox"]')).some(cb => cb.checked);
    const apiReady = baseUrlInput.value.trim() !== "" && apiKeyInput.value.trim() !== "";
    batchTestBtn.disabled = !(apiReady && anyChecked);
}

function disableUI(disable) {
    // Disable major action buttons
    fetchModelsBtn.disabled = disable;
    saveProviderBtn.disabled = disable;
    testModelBtn.disabled = disable;
    batchTestBtn.disabled = disable;
    importProvidersBtn.disabled = disable;
    exportProvidersBtn.disabled = disable;

    // Disable input fields
    baseUrlInput.disabled = disable;
    apiKeyInput.disabled = disable;
    providerNameInput.disabled = disable;
    modelSelect.disabled = disable;
    customModelInput.disabled = disable;

        // Disable provider card buttons
        document.querySelectorAll('.provider-actions button').forEach(button => {
        button.disabled = disable;
    });

        // Disable model checkboxes if disabling
        if (disable) {
            document.querySelectorAll('#modelsContainer input[type="checkbox"]').forEach(checkbox => {
                checkbox.disabled = true;
            });
            selectAllBtn.disabled = true;
            deselectAllBtn.disabled = true;
        } else {
            // Re-enable based on current state when enabling UI
            updateTestButtonState();
            updateBatchTestButton();
            document.querySelectorAll('#modelsContainer input[type="checkbox"]').forEach(checkbox => {
                checkbox.disabled = false; // Ensure checkboxes are re-enabled
            });
            selectAllBtn.disabled = false;
            deselectAllBtn.disabled = false;
        }
}

function logResult(message, type = 'info') {
    resultArea.classList.remove('success', 'error', 'info'); // Clear previous types
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div'); // Use divs for better structure
    logEntry.textContent = `[${timestamp}] ${message}`;

    if (type) {
            resultArea.classList.add(type);
            logEntry.classList.add(`status-${type}`); // Add status class to entry too if needed
    }

        // Prepend new message
    resultArea.insertBefore(logEntry, resultArea.firstChild);

    // Limit log entries (optional)
    const maxEntries = 50;
        if (resultArea.children.length > maxEntries) {
            resultArea.removeChild(resultArea.lastChild);
        }

    // Scroll to top to show latest message
    resultArea.scrollTop = 0;
}

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// --- API Call Functions ---

async function fetchModels() {
    const baseUrl = baseUrlInput.value.trim().replace(/\/$/, "");
    const apiKey = apiKeyInput.value.trim();

    if (!baseUrl || !apiKey) {
        logResult("错误: 请输入 Base URL 和 API Key。", 'error');
        return;
    }

    logResult("正在获取模型列表...", 'info');
    showLoader(loaderModels, true);
    disableUI(true);
    modelSelect.innerHTML = '<option value="">-- 获取中... --</option>';
    modelsContainer.innerHTML = '<div>正在获取模型列表...</div>';

    try {
        const modelsUrl = `${baseUrl}${baseUrl.endsWith('/v1') ? '' : '/v1'}/models`;
        const response = await fetchWithTimeout(modelsUrl, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${apiKey}` }
        }, Number(timeoutInput.value));

        const data = await response.json();

        if (!response.ok) {
                let errorMsg = `API 错误: ${response.status} ${response.statusText}`;
                if (data && data.error && data.error.message) {
                    errorMsg += ` - ${data.error.message}`;
                } else {
                    errorMsg += ` - ${JSON.stringify(data)}`;
                }
                throw new Error(errorMsg);
        }

        const models = data.data;
        if (!models || !Array.isArray(models)) {
                throw new Error("API 响应格式错误，预期 'data' 数组。响应: " + JSON.stringify(data));
        }

        modelSelect.innerHTML = '<option value="">-- 请选择一个模型 --</option>';
        modelsContainer.innerHTML = ''; // Clear previous checkboxes

        if (models.length === 0) {
                logResult("未找到此 Provider 的模型。", 'info');
                modelSelect.innerHTML = '<option value="">-- 未找到模型 --</option>';
                modelsContainer.innerHTML = '<div class="no-models">未找到此 Provider 的模型。</div>';
        } else {
            const sortedModels = models.sort((a, b) => a.id.localeCompare(b.id));

            // Populate dropdown
            sortedModels.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.id;
                modelSelect.appendChild(option);
            });

            // Populate checkboxes
            sortedModels.forEach(model => {
                const div = document.createElement('div');
                div.className = 'model-checkbox';
                const checkboxId = `model-cb-${model.id.replace(/[^a-zA-Z0-9-_]/g, '')}`; // Sanitize ID
                div.innerHTML = `
                    <input type="checkbox" id="${checkboxId}" value="${escapeHtml(model.id)}">
                    <label for="${checkboxId}">${escapeHtml(model.id)}</label>
                `;
                    // Add event listener directly
                div.querySelector('input[type="checkbox"]').addEventListener('change', updateBatchTestButton);
                modelsContainer.appendChild(div);
            });

            logResult(`成功获取 ${models.length} 个模型。`, 'success');
        }
        saveCurrentData(); // Save URL/Key if successful
    } catch (error) {
        console.error("获取模型错误:", error);
        logResult(`获取模型失败: ${error.message}\n请检查控制台和 Provider 的 CORS 设置。`, 'error');
        modelSelect.innerHTML = '<option value="">-- 获取错误 --</option>';
        modelsContainer.innerHTML = '<div class="no-models">获取模型列表时出错。</div>';
    } finally {
        showLoader(loaderModels, false);
        disableUI(false);
            // Ensure test button state is correct after fetch completes/fails
            updateTestButtonState();
            updateBatchTestButton(); // Also update batch button state
    }
}

async function testModel() {
    const baseUrl = baseUrlInput.value.trim().replace(/\/$/, "");
    const apiKey = apiKeyInput.value.trim();
    const selectedModel = customModelInput.value.trim() || modelSelect.value; // Prioritize custom input
    if (testPromptInput.value.trim() === '') {
        testPromptInput.value = '你好，请简短地介绍一下你自己'
    }
    const testPrompt = testPromptInput.value.trim();

    if (!baseUrl || !apiKey || !selectedModel || selectedModel === "-- 请先获取模型列表 --" || selectedModel === "-- Select a model --") {
        logResult("错误: 请确保已输入 Base URL、API Key，并已选择或输入模型名称。", 'error');
        return;
    }

    const useStreaming = enableStreamingCheckbox.checked;

    logResult(`正在向模型发送测试消息: ${selectedModel}...${useStreaming ? ' (流式模式)' : ''}`, 'info');
    showLoader(loaderTest, true);
    disableUI(true);
    resultArea.innerHTML = ''; // Clear previous results before starting test
    resultArea.classList.remove('success', 'error', 'info'); // Clear status classes


    try {
        if (useStreaming) {
            await testModelWithStreaming(baseUrl, apiKey, selectedModel, testPrompt);
        } else {
            const result = await testSingleModel(baseUrl, apiKey, selectedModel, testPrompt);
            // Display non-streaming result
            resultArea.classList.add('success'); // Add success class for non-streaming
            resultArea.textContent = `模型: ${selectedModel}\n状态: 成功\n响应:\n\n${result.content}`;
            logResult(`测试成功! 模型: ${selectedModel}`, 'success'); // Log separately
        }

        // If custom model was used and successful, save it
        if (customModelInput.value.trim() === selectedModel) {
            saveCurrentData();
        }
    } catch (error) {
        console.error("测试模型错误:", error);
        // Display error in result area
        resultArea.classList.add('error');
        resultArea.textContent = `模型: ${selectedModel}\n状态: 失败\n错误: ${error.message}`;
        logResult(`测试模型 ${selectedModel} 失败: ${error.message}`, 'error'); // Log separately
    } finally {
        showLoader(loaderTest, false);
        disableUI(false);
            updateTestButtonState(); // Update button state after test
    }
}

async function testModelWithStreaming(baseUrl, apiKey, modelName, userPrompt) {
        const timestamp = new Date().toLocaleTimeString();
        resultArea.classList.add('info'); // Indicate streaming in progress
        const startMessage = document.createElement('div');
        startMessage.textContent = `[${timestamp}] 开始流式测试模型: ${modelName}...\n\n响应:\n`;
        resultArea.appendChild(startMessage);

        const streamResponseEl = document.createElement('span');
        streamResponseEl.id = 'streamResponse';
        resultArea.appendChild(streamResponseEl); // Append span for content

        const typingIndicator = document.createElement('span');
        typingIndicator.classList.add('stream-typing');
        resultArea.appendChild(typingIndicator); // Append typing indicator

        const payload = {
            model: modelName,
            messages: [{ role: "user", content: userPrompt}],
            max_tokens: 250,
            temperature: 0.7,
            stream: true
        };
        const chatUrl = `${baseUrl}${baseUrl.endsWith('/v1') ? '' : '/v1'}/chat/completions`;

        try {
            const response = await fetchWithTimeout(chatUrl, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }, Number(timeoutInput.value));

            if (!response.ok || !response.body) {
                const errorText = await response.text();
                let errorData;
                try { errorData = JSON.parse(errorText); } catch (e) { errorData = { message: errorText }; }
                throw new Error(`API 错误: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullContent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split("\n");

                for (const line of lines) {
                    if (line.trim().startsWith('data: ')) {
                        const jsonData = line.trim().substring(5).trim();
                        if (jsonData === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(jsonData);
                            if (parsed.choices && parsed.choices[0]?.delta?.content) {
                                const content = parsed.choices[0].delta.content;
                                fullContent += content;
                                streamResponseEl.textContent += content; // Append content directly
                                resultArea.scrollTop = resultArea.scrollHeight; // Auto-scroll
                            }
                        } catch (e) {
                            console.warn('解析流式 JSON 失败:', jsonData, e);
                            streamResponseEl.textContent += `[无法解析块: ${jsonData}]`; // Indicate parsing issue
                        }
                    }
                }
            }

            // Streaming finished successfully
            resultArea.removeChild(typingIndicator); // Remove typing indicator
            const completionMessage = document.createElement('div');
            completionMessage.textContent = `\n[${new Date().toLocaleTimeString()}] 流式传输完成。`;
            completionMessage.style.fontWeight = 'bold';
            completionMessage.style.color = 'var(--success-color)';
            resultArea.appendChild(completionMessage);
            resultArea.scrollTop = resultArea.scrollHeight;
            resultArea.classList.remove('info'); // Remove info class
            resultArea.classList.add('success'); // Add success class
            logResult(`流式测试成功: ${modelName}`, 'success'); // Log completion

            return { success: true, content: fullContent };

        } catch (error) {
            console.error(`流式测试 ${modelName} 错误:`, error);
            if (typingIndicator.parentNode === resultArea) {
            resultArea.removeChild(typingIndicator); // Ensure indicator is removed on error
            }
            const errorMessageEl = document.createElement('div');
            errorMessageEl.className = 'error';
            errorMessageEl.textContent = `\n[${new Date().toLocaleTimeString()}] 流式测试错误: ${error.message}`;
            resultArea.appendChild(errorMessageEl);
            resultArea.scrollTop = resultArea.scrollHeight;
            resultArea.classList.remove('info');
            resultArea.classList.add('error'); // Mark area as error
            throw error; // Re-throw for the caller (testModel)
        }
}

async function testSingleModel(baseUrl, apiKey, modelName, userPrompt) {
    const payload = {
        model: modelName,
        messages: [{ role: "user", content: userPrompt }],
        max_tokens: 80, // Reasonable limit for single test
        temperature: 0.7,
        stream: false // Explicitly false for this function
    };
    const chatUrl = `${baseUrl}${baseUrl.endsWith('/v1') ? '' : '/v1'}/chat/completions`;

    const response = await fetchWithTimeout(chatUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }, Number(timeoutInput.value));

    const data = await response.json();

    if (!response.ok) {
            let errorMsg = `API 错误: ${response.status} ${response.statusText}`;
            if (data && data.error && data.error.message) {
                errorMsg += ` - ${data.error.message}`;
            } else {
                errorMsg += ` - ${JSON.stringify(data)}`;
            }
        throw new Error(errorMsg);
    }

    let messageContent = "在响应中未找到消息内容。";
    if (data.choices && data.choices[0]?.message?.content) {
        messageContent = data.choices[0].message.content;
    } else {
        console.warn("无法在标准路径找到消息内容。完整响应:", data);
        messageContent = `收到响应，但无法提取消息内容。\n原始响应: ${JSON.stringify(data, null, 2)}`;
    }
    return { success: false, content: messageContent };
}

// 修改 batchTestModels 函数以支持结果排序
async function batchTestModels() {
    const baseUrl = baseUrlInput.value.trim().replace(/\/$/, "");
    const apiKey = apiKeyInput.value.trim();
    const selectedModels = Array.from(document.querySelectorAll('#modelsContainer input[type="checkbox"]:checked')).map(cb => cb.value);
    const threadCount = parseInt(threadCountInput.value, 10);

    if (!baseUrl || !apiKey) {
        logResult("错误: 请输入 Base URL 和 API Key。", 'error'); 
        return;
    }
    if (selectedModels.length === 0) {
        logResult("错误: 请至少选择一个模型进行测试。", 'error'); 
        return;
    }
    if (threadCount < 1 || isNaN(threadCount)) {
        logResult("错误: 线程数必须大于0。", 'error');
        return;
    }
    
    logResult(`开始批量测试 ${selectedModels.length} 个模型，使用 ${threadCount} 个线程...`, 'info');
    showLoader(loaderBatchTest, true);
    disableUI(true);
    testResultsBody.innerHTML = ''; // Clear previous results
    testResultsContainer.style.display = 'block'; // Show table
    
    // 创建占位行
    selectedModels.forEach(model => {
        const row = document.createElement('tr');
        const sanitizedModelId = model.replace(/[^a-zA-Z0-9-_]/g, ''); // Sanitize for ID
        row.id = `result-row-${sanitizedModelId}`;
        row.innerHTML = `
            <td>${escapeHtml(model)}</td>
            <td class="status-pending">等待中</td>
            <td>-</td>
        `;
        testResultsBody.appendChild(row);
    });
    
    // 使用线程池方式并发测试
    await runTestsWithConcurrency(baseUrl, apiKey, selectedModels, threadCount);
    
    // 测试完成后对结果进行排序，将成功的模型移到前面
    sortTestResults();
    
    showLoader(loaderBatchTest, false);
    disableUI(false);
    logResult(`批量测试完成 ${selectedModels.length} 个模型。`, 'success');
}

// 新增排序函数，将成功的模型移到前面
function sortTestResults() {
    const tbody = document.getElementById('testResultsBody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    // 按状态排序：成功 > 失败
    rows.sort((a, b) => {
        const statusA = a.querySelector('td:nth-child(2)').className;
        const statusB = b.querySelector('td:nth-child(2)').className;
        
        if (statusA.includes('status-success') && !statusB.includes('status-success')) {
            return -1; // A成功，B失败，A排前面
        } else if (!statusA.includes('status-success') && statusB.includes('status-success')) {
            return 1; // B成功，A失败，B排前面
        }
        return 0; // 状态相同，保持原顺序
    });
    
    // 清空表格体并重新添加排序后的行
    while (tbody.firstChild) {
        tbody.removeChild(tbody.firstChild);
    }
    rows.forEach(row => tbody.appendChild(row));
}

// 添加并发控制函数
async function runTestsWithConcurrency(baseUrl, apiKey, models, concurrency) {
    const queue = [...models];
    const activePromises = new Set();
    
    // 创建指定数量的worker
    const workers = Array.from({ length: Math.min(concurrency, models.length) }, async () => {
        while (queue.length > 0) {
            const model = queue.shift();
            const promise = testModelInBatch(baseUrl, apiKey, model)
                .finally(() => {
                    activePromises.delete(promise);
                });
            activePromises.add(promise);
            await promise;
        }
    });
    
    // 等待所有worker完成
    await Promise.all(workers);
    // 确保所有promise都已完成
    await Promise.all([...activePromises]);
}

// 在事件监听器中添加线程数量输入框的限制
threadCountInput.addEventListener('input', () => {
    let value = parseInt(threadCountInput.value, 10);
    if (isNaN(value) || value < 1) {
        threadCountInput.value = 1;
    } else if (value > 20) {
        threadCountInput.value = 20;
    }
});

async function testModelInBatch(baseUrl, apiKey, model) {
    const sanitizedModelId = model.replace(/[^a-zA-Z0-9-_]/g, ''); // Sanitize for ID
    const row = document.getElementById(`result-row-${sanitizedModelId}`);
    if (!row) return; // Should not happen
    const statusCell = row.querySelector('td:nth-child(2)');
    const responseCell = row.querySelector('td:nth-child(3)');
    if (testPromptInput.value.trim() === '') {
        testPromptInput = '今天的天气真不错，不是吗'
    }
    const testPrompt = testPromptInput.value.trim();

    statusCell.className = 'status-running';
    statusCell.textContent = '测试中...';

    try {
        // Use the non-streaming test function for batch tests
        const result = await testSingleModel(baseUrl, apiKey, model, testPrompt);
        statusCell.className = 'status-success';
        statusCell.textContent = '成功';
        let displayResponse = escapeHtml(result.content);
        if (displayResponse.length > 150) { // Limit preview length
            displayResponse = displayResponse.substring(0, 150) + '...';
        }
        responseCell.textContent = displayResponse;
    } catch (error) {
        console.error(`批量测试 ${model} 错误:`, error);
        statusCell.className = 'status-error';
        statusCell.textContent = '失败';
            let displayError = escapeHtml(error.message);
            if (displayError.length > 150) {
                displayError = displayError.substring(0, 150) + '...';
            }
        responseCell.textContent = displayError; // Show error message
            responseCell.title = error.message; // Show full error on hover
    }
}

// --- Event Listeners Setup ---

// Core actions
fetchModelsBtn.addEventListener('click', fetchModels);
testModelBtn.addEventListener('click', testModel);
saveProviderBtn.addEventListener('click', saveProvider);
exportProvidersBtn.addEventListener('click', exportProviders);
importProvidersBtn.addEventListener('click', () => importProvidersFile.click());
importProvidersFile.addEventListener('change', importProviders);

// Input changes triggering UI updates or saving state
baseUrlInput.addEventListener('input', () => { saveCurrentData(); updateTestButtonState(); });
apiKeyInput.addEventListener('input', () => { saveCurrentData(); updateTestButtonState(); });
modelSelect.addEventListener('change', updateTestButtonState);
customModelInput.addEventListener('input', () => { saveCurrentData(); updateTestButtonState(); });
providerNameInput.addEventListener('input', saveCurrentData); // Save name as it's typed
enableStreamingCheckbox.addEventListener('change', saveStreamingPreference);

// Toggle views
toggleModelsBtn.addEventListener('click', () => {
    singleModelSection.style.display = 'none';
    multiModelSection.style.display = 'block';
    updateBatchTestButton(); // Update button state when switching
});
toggleModelsBackBtn.addEventListener('click', () => {
    multiModelSection.style.display = 'none';
    singleModelSection.style.display = 'block';
    updateTestButtonState(); // Update button state when switching back
});

// Multi-model selection actions
selectAllBtn.addEventListener('click', () => {
    document.querySelectorAll('#modelsContainer input[type="checkbox"]').forEach(cb => cb.checked = true);
    updateBatchTestButton();
});
deselectAllBtn.addEventListener('click', () => {
    document.querySelectorAll('#modelsContainer input[type="checkbox"]').forEach(cb => cb.checked = false);
    updateBatchTestButton();
});

// Batch test trigger
batchTestBtn.addEventListener('click', batchTestModels);

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', loadSavedData);