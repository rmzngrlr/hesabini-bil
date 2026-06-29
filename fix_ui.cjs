const fs = require('fs');
let content = fs.readFileSync('src/pages/DailyExpenses.tsx', 'utf8');

const sCard = `      {!isFuture ? (
        <Card title={editingId ? "Kayıt Düzenle" : "Yeni Kazanç/Harcama Ekle"}>
            <form onSubmit={handleSubmit} className="space-y-3 mt-2">
            <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground">Tarih</label>
                <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                </div>
                <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground">{isGoldType(type) ? 'Miktar' : 'Tutar'}</label>
                <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                </div>
            </div>

            {isGoldType(type) ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Kime Ait</label>
                    <input
                      type="text"
                      required
                      placeholder="Örn: Ahmet"
                      value={goldOwner}
                      onChange={(e) => setGoldOwner(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Not</label>
                    <input
                      type="text"
                      placeholder="İsteğe Bağlı"
                      value={goldNote}
                      onChange={(e) => setGoldNote(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                      {goldTransactionType === 'Bozdurma' ? 'Satış Tutarı (TL) - İsteğe Bağlı' : 'Alış Tutarı (TL) - İsteğe Bağlı'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={goldPriceTL}
                      onChange={(e) => setGoldPriceTL(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Açıklama</label>
                <input
                  type="text"
                  required
                  list="daily-expense-suggestions"
                  placeholder="Bu para nereden geldi/nereye gitti?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <datalist id="daily-expense-suggestions">
                  {uniqueDescriptions.map((desc, idx) => (
                    <option key={idx} value={desc} />
                  ))}
                </datalist>
              </div>
            )}

            {isGoldType(type) ? (
              <div className="flex gap-2 pt-1">
                  <button
                  type="button"
                  onClick={() => { setGoldTransactionType('Birikim'); setTransactionType('INCOME'); }}
                  className={\`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border transition-colors \${goldTransactionType === 'Birikim' ? 'bg-green-500/10 border-green-500 text-green-500' : 'bg-secondary border-transparent text-muted-foreground'}\`}
                  >
                  Birikim
                  </button>
                  <button
                  type="button"
                  onClick={() => { setGoldTransactionType('Bozdurma'); setTransactionType('EXPENSE'); }}
                  className={\`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border transition-colors \${goldTransactionType === 'Bozdurma' ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-secondary border-transparent text-muted-foreground'}\`}
                  >
                  Bozdurma
                  </button>

              </div>
            ) : (
              <div className="flex gap-2 pt-1">
                  <button
                  type="button"
                  onClick={() => setTransactionType('INCOME')}
                  className={\`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border transition-colors \${transactionType === 'INCOME' ? 'bg-green-500/10 border-green-500 text-green-500' : 'bg-secondary border-transparent text-muted-foreground'}\`}
                  >
                  Gelir (+)
                  </button>
                  <button
                  type="button"
                  onClick={() => setTransactionType('EXPENSE')}
                  className={\`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border transition-colors \${transactionType === 'EXPENSE' ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-secondary border-transparent text-muted-foreground'}\`}
                  >
                  Gider (-)
                  </button>
              </div>
            )}

            <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Varlık / Para Birimi</label>
                <select
                  value={type}
                  onChange={(e) => { setType(e.target.value); if (e.target.value !== 'NEW_CURRENCY') setActiveTab(e.target.value); }}
                  className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                >
                  <optgroup label="Para Birimleri">
                    <option value="NAKIT">Türk Lirası</option>
                    {showMealCard && <option value="YK">Yemek Kartı</option>}
                    {activeCurrencies.map(curr => (
                      <option key={curr} value={curr}>{getAssetFullTitle(curr)}</option>
                    ))}
                    <option value="NEW_CURRENCY">+ Diğer Para Birimi Ekle...</option>
                  </optgroup>
                  <optgroup label="Altın Türleri (Kasa)">
                    {allFormTypes.golds.map(gold => (
                      <option key={gold} value={gold}>{getAssetFullTitle(gold)}</option>
                    ))}
                  </optgroup>
                </select>
            </div>`;

const rCard = `      {!isFuture ? (
        <div className="space-y-4">
          <div className="flex gap-2">
             <button
                onClick={() => setShowExchangeForm(false)}
                className={cn(
                   "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
                   !showExchangeForm ? "bg-primary text-primary-foreground shadow" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                )}
             >
                Normal İşlem
             </button>
             <button
                onClick={() => setShowExchangeForm(true)}
                className={cn(
                   "flex-1 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2",
                   showExchangeForm ? "bg-primary text-primary-foreground shadow" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                )}
             >
                <ArrowRightLeft size={16} /> Döviz/Altın Dönüştür
             </button>
          </div>

        {showExchangeForm ? (
          <Card title="Varlık Dönüştür (Takas)">
            <div className="flex gap-2 mb-4 bg-secondary p-1 rounded-lg">
               <button
                  type="button"
                  onClick={() => setExchangeTabMode('CURRENCY')}
                  className={cn(
                     "flex-1 py-1.5 text-sm font-medium rounded-md transition-all",
                     exchangeTabMode === 'CURRENCY' ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"
                  )}
               >
                  Döviz Takası
               </button>
               <button
                  type="button"
                  onClick={() => setExchangeTabMode('GOLD')}
                  className={cn(
                     "flex-1 py-1.5 text-sm font-medium rounded-md transition-all",
                     exchangeTabMode === 'GOLD' ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"
                  )}
               >
                  Altın İşlemleri (Kasa)
               </button>
            </div>

            {exchangeTabMode === 'CURRENCY' ? (
            <form onSubmit={handleExchangeSubmit} className="space-y-3 mt-2">
              <div className="flex gap-2 items-center">
                <div className="flex-[2] space-y-1">
                   <label className="text-xs text-muted-foreground">Verilen Birim</label>
                   <select value={exchangeFromType} onChange={e => setExchangeFromType(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary focus:ring-2 focus:ring-primary">
                     <optgroup label="Para Birimleri">{assetOptions}</optgroup>
                     <optgroup label="Altın Türleri">
                       {allFormTypes.golds.map(gold => (<option key={gold} value={gold}>{getAssetFullTitle(gold)}</option>))}
                     </optgroup>
                   </select>
                </div>
                <div className="flex-1 space-y-1">
                   <label className="text-xs text-muted-foreground">Tutar</label>
                   <input type="number" step="0.001" required placeholder="0.00" value={exchangeFromAmount} onChange={e => setExchangeFromAmount(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary focus:ring-2 focus:ring-primary" />
                </div>
              </div>

              {exchangeFromType === 'NEW_CURRENCY' && (
                 <div className="space-y-1 mb-2">
                   <label className="text-xs text-muted-foreground">Yeni Verilen Para Birimi Adı (Örn: Dolar)</label>
                   <input type="text" required placeholder="Para Birimi Girin" value={exchangeFromCustomCode} onChange={e => setExchangeFromCustomCode(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary focus:ring-2 focus:ring-primary font-medium" />
                 </div>
              )}

              <div className="flex justify-center text-muted-foreground py-1">
                <ArrowRightLeft size={20} className="rotate-90" />
              </div>

              <div className="flex gap-2 items-center">
                <div className="flex-[2] space-y-1">
                   <label className="text-xs text-muted-foreground">Alınan Birim</label>
                   <select value={exchangeToType} onChange={e => setExchangeToType(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary focus:ring-2 focus:ring-primary">
                     <optgroup label="Para Birimleri">{assetOptions}</optgroup>
                     <optgroup label="Altın Türleri">
                       {allFormTypes.golds.map(gold => (<option key={gold} value={gold}>{getAssetFullTitle(gold)}</option>))}
                     </optgroup>
                   </select>
                </div>
                <div className="flex-1 space-y-1">
                   <label className="text-xs text-muted-foreground">Tutar</label>
                   <input type="number" step="0.001" required placeholder="0.00" value={exchangeToAmount} onChange={e => setExchangeToAmount(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary focus:ring-2 focus:ring-primary" />
                </div>
              </div>

              {exchangeToType === 'NEW_CURRENCY' && (
                 <div className="space-y-1 mt-1 mb-2">
                   <label className="text-xs text-muted-foreground">Yeni Alınan Para Birimi Adı (Örn: Dolar)</label>
                   <input type="text" required placeholder="Para Birimi Girin" value={exchangeToCustomCode} onChange={e => setExchangeToCustomCode(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary focus:ring-2 focus:ring-primary font-medium" />
                 </div>
              )}

              <div className="flex gap-2">
                 <div className="flex-[2] space-y-1">
                    <label className="text-xs text-muted-foreground">Açıklama / Kur Bilgisi (İsteğe Bağlı)</label>
                    <input type="text" placeholder="Örn: 1 Dolar = 35 TL" value={exchangeNote} onChange={e => setExchangeNote(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary focus:ring-2 focus:ring-primary" />
                 </div>
                 <div className="flex-1 space-y-1">
                    <label className="text-xs text-muted-foreground">Tarih</label>
                    <input type="date" value={exchangeDate} onChange={e => setExchangeDate(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary focus:ring-2 focus:ring-primary" />
                 </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 mt-4 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors"
              >
                Dönüştür
              </button>
            </form>
            ) : (
            <form onSubmit={handleSubmit} className="space-y-3 mt-2">
            <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground">Tarih</label>
                <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                </div>
                <div className="flex-[2] space-y-1">
                <label className="text-xs text-muted-foreground">Miktar</label>
                <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                </div>
            </div>

              <div className="space-y-3 border border-border p-3 rounded-lg bg-secondary/20">
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs text-muted-foreground">Altın Sahibi</label>
                    <input
                      type="text"
                      placeholder="Kimin Adına?"
                      value={goldOwner}
                      onChange={(e) => setGoldOwner(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Not</label>
                    <input
                      type="text"
                      placeholder="İsteğe Bağlı"
                      value={goldNote}
                      onChange={(e) => setGoldNote(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                      {goldTransactionType === 'Bozdurma' ? 'Satış Tutarı (TL) - İsteğe Bağlı' : 'Alış Tutarı (TL) - İsteğe Bağlı'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={goldPriceTL}
                      onChange={(e) => setGoldPriceTL(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
              </div>

              <div className="flex gap-2 pt-1">
                  <button
                  type="button"
                  onClick={() => { setGoldTransactionType('Birikim'); setTransactionType('INCOME'); }}
                  className={\`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border transition-colors \${goldTransactionType === 'Birikim' ? 'bg-green-500/10 border-green-500 text-green-500' : 'bg-secondary border-transparent text-muted-foreground'}\`}
                  >
                  Birikim
                  </button>
                  <button
                  type="button"
                  onClick={() => { setGoldTransactionType('Bozdurma'); setTransactionType('EXPENSE'); }}
                  className={\`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border transition-colors \${goldTransactionType === 'Bozdurma' ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-secondary border-transparent text-muted-foreground'}\`}
                  >
                  Bozdurma
                  </button>
              </div>

            <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Altın Türü</label>
                <select
                  value={type}
                  onChange={(e) => { setType(e.target.value); setActiveTab(e.target.value); }}
                  className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                >
                  <optgroup label="Altın Türleri (Kasa)">
                    {allFormTypes.golds.map(gold => (
                      <option key={gold} value={gold}>{getAssetFullTitle(gold)}</option>
                    ))}
                  </optgroup>
                </select>
            </div>`;
content = content.replace(sCard, rCard);

const endCard = `            <div className="flex gap-2 mt-2">
                {editingId && (
                <button
                    type="button"
                    onClick={cancelEdit}
                    className="flex-1 py-3 bg-secondary text-foreground font-medium rounded-lg hover:bg-secondary/80 transition-colors flex items-center justify-center gap-2"
                >
                    <X size={20} /> İptal
                </button>
                )}
                <button
                type="submit"
                className="flex-[2] py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors"
                >
                {editingId ? 'Güncelle' : 'Ekle'}
                </button>
            </div>
            </form>
        </Card>
      ) : (`;

const rEndCard = `            <div className="flex gap-2 mt-2">
                {editingId && (
                <button
                    type="button"
                    onClick={cancelEdit}
                    className="flex-1 py-3 bg-secondary text-foreground font-medium rounded-lg hover:bg-secondary/80 transition-colors flex items-center justify-center gap-2"
                >
                    <X size={20} /> İptal
                </button>
                )}
                <button
                type="submit"
                className="flex-[2] py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors"
                >
                {editingId ? 'Güncelle' : 'Altın İşlemini Kaydet'}
                </button>
            </div>
            </form>
            )}
          </Card>
        ) : (
        <Card title={editingId ? "Kayıt Düzenle" : "Yeni İşlem Ekle"}>
            <form onSubmit={handleSubmit} className="space-y-3 mt-2">
            <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground">Tarih</label>
                <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                </div>
                <div className="flex-[2] space-y-1">
                <label className="text-xs text-muted-foreground">Tutar</label>
                <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                </div>
            </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Açıklama</label>
                <input
                  type="text"
                  required
                  list="daily-expense-suggestions"
                  placeholder="Bu para nereden geldi/nereye gitti?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <datalist id="daily-expense-suggestions">
                  {uniqueDescriptions.map((desc, idx) => (
                    <option key={idx} value={desc} />
                  ))}
                </datalist>
              </div>

              <div className="flex gap-2 pt-1">
                  <button
                  type="button"
                  onClick={() => setTransactionType('INCOME')}
                  className={\`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border transition-colors \${transactionType === 'INCOME' ? 'bg-green-500/10 border-green-500 text-green-500' : 'bg-secondary border-transparent text-muted-foreground'}\`}
                  >
                  Gelir (+)
                  </button>
                  <button
                  type="button"
                  onClick={() => setTransactionType('EXPENSE')}
                  className={\`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border transition-colors \${transactionType === 'EXPENSE' ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-secondary border-transparent text-muted-foreground'}\`}
                  >
                  Gider (-)
                  </button>
              </div>

            <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Varlık / Para Birimi</label>
                <select
                  value={type}
                  onChange={(e) => { setType(e.target.value); if (e.target.value !== 'NEW_CURRENCY') setActiveTab(e.target.value); }}
                  className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                >
                  <optgroup label="Para Birimleri">
                    {assetOptions}
                  </optgroup>
                </select>
            </div>

            {type === 'NEW_CURRENCY' && (
              <div className="space-y-1 mt-2">
                <label className="text-xs text-muted-foreground">Yeni Para Birimi Adı, Sembolü veya Kodu (Örn: Dolar, $, Euro, €)</label>
                <input
                  type="text"
                  required
                  placeholder="Para Birimi Girin (Örn: Dolar, $, Euro)"
                  value={customCurrencyCode}
                  onChange={(e) => setCustomCurrencyCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                />
              </div>
            )}

            <div className="flex gap-2 mt-2">
                {editingId && (
                <button
                    type="button"
                    onClick={cancelEdit}
                    className="flex-1 py-3 bg-secondary text-foreground font-medium rounded-lg hover:bg-secondary/80 transition-colors flex items-center justify-center gap-2"
                >
                    <X size={20} /> İptal
                </button>
                )}
                <button
                type="submit"
                className="flex-[2] py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors"
                >
                {editingId ? 'Güncelle' : 'Ekle'}
                </button>
            </div>
            </form>
        </Card>
        </div>
      ) : (`;
content = content.replace(endCard, rEndCard);

fs.writeFileSync('src/pages/DailyExpenses.tsx', content);
