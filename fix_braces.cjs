const fs = require('fs');
let content = fs.readFileSync('src/pages/DailyExpenses.tsx', 'utf8');

const s = `            </div>
            </form>
        </Card>
        </div>
      ) : (`;

const r = `            </div>
            </form>
        </Card>
        )}
        </div>
      ) : (`;

content = content.replace(s, r);

fs.writeFileSync('src/pages/DailyExpenses.tsx', content);
