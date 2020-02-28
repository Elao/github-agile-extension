MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

chrome.runtime.sendMessage({}, () => {
  const readyStateCheckInterval = setInterval(() => {
    if (document.readyState === 'complete') {
      clearInterval(readyStateCheckInterval);

      start();
    }
  }, 10);
});

const splitPath = window.location.pathname.split('/');
const regConsumed = /\[([0-9\.]*)\]/; // match with [x] or [x-y]
const regEstimated = /\(([0-9\.]*)\)/; // match with (x)

function start() {
  const currentPage = splitPath[3];

  // Init
  if (currentPage === 'projects') {
    updateProjects();
  } else if (currentPage === 'issues') {
    updateIssues();
  }

  // Mutation observer
  const observer = new MutationObserver((mutations) => {
    let nodes = [];
    
    mutations.forEach((mutation) => {
      nodes = [
        ...nodes,
        ...mutation.addedNodes,
        ...mutation.removedNodes,
      ];
    });

    nodes.some((node) => {
      if (node.classList && node.classList.contains('js-project-column-card')) {
        updateProjects();

        return true;
      }

      if (node.classList && node.classList.contains('new-discussion-timeline')) {
        updateIssues();

        return true;
      }
    });
  });
  
  const projectContainer = document.querySelector('.project-columns-container');
  const issuesContainer = document.querySelector('#js-repo-pjax-container');
  const searchContainer = document.querySelector('[name="card_filter_query"]');

  if (projectContainer) {
    // Listen planning board changes on project page
    observer.observe(projectContainer, {
      subtree: true,
      childList: true,
    });
  }

  if (issuesContainer) {
    // Listen issues changes on issues list page
    observer.observe(issuesContainer, {
      subtree: true,
      childList: true,
    });
  }
  if (searchContainer) {
    // Listen issues changes on search
    observer.observe(searchContainer, {
      subtree: true,
      childList: true,
    });
  }
}

/**
 * Update badges on projects page
 */
function updateProjects() {
  const CSVContent = [];
  let totalConsumedPoints = 0;
  let totalEstimatedPointsMin = 0;
  let totalEstimatedPointsMax = 0;
  

  document.querySelectorAll('div.project-column').forEach((column) => {
    let totalColumnConsumed = 0;
    let totalColumnEstimatedMin = 0;
    let totalColumnEstimatedMax = 0;


    const columnCountElement = column.querySelector('span.js-project-column-name');
    const columnName = columnCountElement.innerText;
    const totalElement = column.querySelector('span.ext-total');
    const titleColumnText = columnCountElement.textContent;
    const deadLineColumnName = ['Later', 'Done', 'Recette / Review'];

    let isDeadlineEstimation = false;
    if(deadLineColumnName.indexOf(columnName) == -1){
      isDeadlineEstimation = true;
    }

    column.querySelectorAll('article.issue-card:not(.d-none)').forEach((card) => {
        let estimatedPointsMin = 0;
        let estimatedPointsMax = 0;
        let consumedPoints = 0;


        str = card.dataset.cardLabel;
        str.substr(1, str.length-2).split(',').forEach(
          function(label){
            //console.log(label);
            switch(label) {
              case '"xl"':
                estimatedPointsMin = 6;
                consumedPoints = 4;
                break;
              case '"l"':
                estimatedPointsMin = 3;
                consumedPoints = 2;
                break;
              case '"m"':
                estimatedPointsMin = 1;
                consumedPoints = 1;
                break;
              case '"s"':
                estimatedPointsMin = 0.5;
                consumedPoints = 0.5;
                break;
            }
           
          }

        );
      let parsed = card.dataset.cardTitle.match(regEstimated);
      estimatedPointsMin = parsed ? parsed[1] : estimatedPointsMin;
      estimatedPointsMax = parsed ? (parsed[3] || parsed[1]) : estimatedPointsMax;
      estimatedPointsMax = estimatedPointsMin;   // Désactivation des bornes pour l'instant
      if (isDeadlineEstimation &&  estimatedPointsMin > 0) {
        totalEstimatedPointsMin += estimatedPointsMin * 1;
        totalColumnEstimatedMin += estimatedPointsMin * 1;
      }

      if (isDeadlineEstimation &&  estimatedPointsMax > 0) {
        totalEstimatedPointsMax += estimatedPointsMax * 1;
        totalColumnEstimatedMax += estimatedPointsMax * 1;
      }




      parsed = card.dataset.cardTitle.match(regConsumed);
      consumedPoints = parsed ? parsed[1] : consumedPoints;

      if (isDeadlineEstimation &&  consumedPoints > 0) {
        totalConsumedPoints += consumedPoints * 1;
        totalColumnConsumed += consumedPoints * 1;
      }

      const cardTitleElement = card.querySelector('a.js-project-card-issue-link') || card.querySelector('div.js-task-list-container p');
      const issueDetailsElement = card.querySelector('div.js-project-issue-details-container') || card.querySelector('div.issue-card .pl-5.p-2');
      const countsElement = card.querySelector('div.ext-counts');


      cardTitleElement.innerHTML = cardTitleElement.innerHTML.trim().replace(regEstimated, '');
      cardTitleElement.innerHTML = cardTitleElement.innerHTML.trim().replace(regConsumed, '');

      const cardHref = cardTitleElement.href;

      // Create CSV file
      CSVContent.push({
        Column: titleColumnText,
        ID: cardHref ? cardHref.split('/').pop() : '/',
        Title: cardTitleElement.textContent,
        URL: cardHref || '/',
        'Min. estimate': estimatedPointsMin,
        'Max. estimate': estimatedPointsMax,
        Consumed: consumedPoints,
      });

      // Render card counts
      let estimatedPoints = estimatedPointsMin;
      if (estimatedPointsMin !== estimatedPointsMax) {
        estimatedPoints = `${estimatedPointsMin} to ${estimatedPointsMax}`;
      }

      const badges = renderBadges(consumedPoints, estimatedPoints);

      if (countsElement) {
        countsElement.innerHTML = badges;
      } else {
        const div = document.createElement('div');
        div.classList.add('ext-counts');
        div.innerHTML = badges;

        issueDetailsElement.appendChild(div);
      }
    });

    // Render column counts
    let totalColumnEstimated = totalColumnEstimatedMin;
    if (totalColumnEstimatedMin !== totalColumnEstimatedMax) {
      totalColumnEstimated = `${totalColumnEstimatedMin} to ${totalColumnEstimatedMax}`;
    }

    const total = renderTotal(totalColumnConsumed, totalColumnEstimated);

    if (totalElement) {
      totalElement.innerHTML = total;
    } else if(isDeadlineEstimation ) {
      const span = document.createElement('span');
      span.classList.add('ext-total');
      span.innerHTML = total;

      columnCountElement.parentNode.appendChild(span);
    }
  });

  const projectHeaderElement = document.querySelector('div.project-header-controls');
  const totalProjectElement = document.querySelector('div.ext-project-total');

  // Render total counts
  let totalEstimatedPoints = totalEstimatedPointsMin;
  if (totalEstimatedPointsMin !== totalEstimatedPointsMax) {
    totalEstimatedPoints = `${totalEstimatedPointsMin} to ${totalEstimatedPointsMax}`;
  }

  const totalProject = renderTotalProject(totalConsumedPoints, totalEstimatedPoints);

  if (totalProjectElement) {
    totalProjectElement.innerHTML = totalProject;
  } else {
    const div = document.createElement('div');
    div.classList.add('ext-project-total');
    div.innerHTML = totalProject;

    projectHeaderElement.parentNode.insertBefore(div, projectHeaderElement);
  }

  let downloadLink = document.querySelector('a.ext-download');

  if (!downloadLink) {
    downloadLink = document.createElement('a');
    downloadLink.classList.add('ext-download');
    downloadLink.href = '#';
    downloadLink.innerHTML = '🔄';

    document.querySelector('div.ext-project-total').appendChild(downloadLink);
  }

  downloadLink.addEventListener('click', (event) => {
    event.preventDefault();
    updateProjects();
    console.log('ereer');
    //downloadCSV({ data: CSVContent });
  });
}

/**
 * Update badges on issues list page
 */
function updateIssues() {
  document.querySelectorAll('.js-issue-row').forEach((issue) => {
    const titleElement = issue.querySelector('.js-navigation-open');
    const issueInfoElement = issue.querySelector('.opened-by');
    const countsElement = issue.querySelector('div.ext-counts');

    let parsed = titleElement.textContent.match(regEstimated);
    const estimatedPointsMin = parsed ? parsed[1] : 0;
    const estimatedPointsMax = parsed ? (parsed[3] || parsed[1]) : 0;

    parsed = titleElement.textContent.match(regConsumed);
    const consumedPoints = parsed ? parsed[1] : 0;

    titleElement.innerHTML = titleElement.innerHTML.trim().replace(regEstimated, '');
    titleElement.innerHTML = titleElement.innerHTML.trim().replace(regConsumed, '');

    // Render issue points
    let estimatedPoints = estimatedPointsMin;
    if (estimatedPointsMin !== estimatedPointsMax) {
      estimatedPoints = `${estimatedPointsMin} to ${estimatedPointsMax}`;
    }

    const badges = renderBadges(consumedPoints, estimatedPoints);

    if (countsElement) {
      countsElement.innerHTML = badges;
    } else {
      const div = document.createElement('div');
      div.classList.add('ext-counts');
      div.innerHTML = badges;

      issueInfoElement.parentNode.appendChild(div);
    }
  });
}

/**
 * Render badge
 *
 * @param {Number} consumed  points
 * @param {Number} estimated points
 *
 * @return {String}
 */
function renderBadges(consumed, estimated) {
  if (!consumed && !estimated) {
    return '';
  }

  const consumedBadge = `<div class="badge badge-consumed">${consumed}</div>`;
  const estimatedBadge = `<div class="badge badge-estimated">${estimated}</div>`;

  if (consumed && !estimated) {
    return consumedBadge;
  }

  if (!consumed && estimated) {
    return estimatedBadge
  }

  return `${consumedBadge} ${estimatedBadge}`;
}

/**
 * Render total by column
 *
 * @param {Number} consumed  points
 * @param {Number} estimated points
 *
 * @return {String}
 */
function renderTotal(consumed, estimated) {
  average = (consumed + estimated)/2;
  return `<span class="color-estimated">${average}</span> <span class="color-consumed">${consumed}-${estimated}</span> `
}

/** 
 * Render total for current project
 *
 * @param {Number} consumed  points
 * @param {Number} estimated points
 *
 * @return {String}
 */
function renderTotalProject(consumed, estimated) {
  average = (consumed + estimated)/2;
  return `<span class="color-estimated"><span class="point">${average}</span></span></span> <span class="color-consumed"><span class="point">${consumed}-${estimated}</span></span> `
}

/**
 * Export array data to CSV
 * 
 * By Chris Grimes (https://halistechnology.com/2015/05/28/use-javascript-to-export-your-data-as-csv)
 */
function convertToCSV(args) {  
  let result, ctr, keys, columnDelimiter, lineDelimiter, data;

  data = args.data || null;
  if (data == null || !data.length) {
    return null;
  }

  columnDelimiter = args.columnDelimiter || ',';
  lineDelimiter = args.lineDelimiter || '\n';

  keys = Object.keys(data[0]);

  result = '';
  result += keys.join(columnDelimiter);
  result += lineDelimiter;

  data.forEach((item) => {
    ctr = 0;

    keys.forEach((key) => {
      if (ctr > 0) {
        result += columnDelimiter;
      }

      result += item[key];
      ctr++;
    });

    result += lineDelimiter;
  });

  return result;
}

function downloadCSV(args) {  
  let data, filename, link;
  let csv = convertToCSV({ data: args.data });
  const projectName = `${splitPath[1]}/${splitPath[2]}`;

  if (csv == null) {
    return;
  }

  filename = args.filename || `export-${projectName}.csv`;

  if (!csv.match(/^data:text\/csv/i)) {
    csv = `data:text/csv;charset=utf-8,${csv}`;
  }

  data = encodeURI(csv);

  link = document.createElement('a');
  link.setAttribute('href', data);
  link.setAttribute('download', filename);
  link.click();
}
